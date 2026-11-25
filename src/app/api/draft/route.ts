import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { campaigns, prospects, settings } from "@/lib/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import { GeminiProvider } from "@/lib/providers/llm/gemini";
import { OpenAIProvider } from "@/lib/providers/llm/openai";
import { AnthropicProvider } from "@/lib/providers/llm/anthropic";
import type { ILLMProvider, SegmentContext, FitScoreResult } from "@/lib/providers/llm/types";
import type { UserProfile } from "@/lib/providers/x/types";
import { validateDraft } from "@/lib/guardrails/validate-draft";
import { HeuristicSandboxProvider } from "@/lib/providers/llm/heuristic-sandbox";

function createLLMProvider(provider: string, apiKey: string): ILLMProvider {
  if (!apiKey) {
    return new HeuristicSandboxProvider();
  }
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "gemini":
    default:
      return new GeminiProvider(apiKey);
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { campaignId, minScore = 0.4, prospectIds: rawIds, segment: rawSegment, sender } = body as {
    campaignId?: string;
    minScore?: number;
    prospectIds?: string[];
    segment?: SegmentContext;
    sender?: { fund_name?: string; sender_name?: string } | string;
  };

  if (!campaignId && (!rawIds?.length || !rawSegment)) {
    return NextResponse.json(
      { error: "Missing campaignId or (prospectIds and segment)" },
      { status: 400 }
    );
  }

  let segment: SegmentContext | undefined = rawSegment;
  let targetIds: string[] = rawIds || [];

  if (campaignId) {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .get();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!segment) {
      segment = {
        keywords: (campaign.keywords || []) as string[],
        description: campaign.description || campaign.name,
        fund_focus: "Pre-seed to Series A AI & Robotics in Southeast Asia",
      };
    }

    if (targetIds.length === 0) {
      const scored = await db
        .select({ id: prospects.id })
        .from(prospects)
        .where(
          and(
            eq(prospects.campaignId, campaignId),
            eq(prospects.status, "SCORED"),
            gte(prospects.fitScore, minScore)
          )
        )
        .all();
      targetIds = scored.map((p) => p.id);
    }
  }

  if (!segment) {
    return NextResponse.json({ error: "Missing segment context" }, { status: 400 });
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ drafted: 0, results: [] });
  }

  // Get LLM config
  const allSettings = await db.select().from(settings).all();
  const settingsMap = Object.fromEntries((allSettings as any[]).map((s) => [s.key, s.value]));

  const llmProvider = settingsMap.llm_provider || "gemini";
  const keyMap: Record<string, string | undefined> = {
    gemini: settingsMap.google_api_key || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openai: settingsMap.openai_api_key || process.env.OPENAI_API_KEY,
    anthropic: settingsMap.anthropic_api_key || process.env.ANTHROPIC_API_KEY,
  };
  const apiKey = keyMap[llmProvider] || "";

  // Use configured live provider or fallback to zero-config Sandbox engine
  const llm = createLLMProvider(llmProvider, apiKey);
  const senderCtx =
    typeof sender === "string"
      ? { fund_name: "GenAI Fund", sender_name: sender || "GenAI Fund Team" }
      : {
          fund_name: sender?.fund_name || "GenAI Fund",
          sender_name: sender?.sender_name || "GenAI Fund Team",
        };

  const candidateRows = await db
    .select()
    .from(prospects)
    .where(and(inArray(prospects.id, targetIds), eq(prospects.status, "SCORED")))
    .all();

  const results: { id: string; status: string; draft?: string; errors?: string[] }[] = [];

  for (const prospect of candidateRows) {
    try {
      const profile: UserProfile = {
        x_user_id: prospect.xUserId,
        username: prospect.xUsername || "",
        display_name: prospect.xDisplayName || "",
        bio: prospect.xBio || "",
        location: prospect.xLocation || "",
        follower_count: prospect.xFollowerCount || 0,
        verified: !!prospect.xVerified,
        profile_image_url: prospect.xProfileImageUrl || "",
        recent_tweets: (prospect.recentTweets || []) as UserProfile["recent_tweets"],
        pinned_tweet: (prospect.pinnedTweet || null) as UserProfile["pinned_tweet"],
      };

      const fitResult: FitScoreResult = {
        fit_score: prospect.fitScore || 0,
        fit_reasoning: (prospect.fitReasoning || "").split("\n"),
        evidence_sources: (prospect.evidenceSources || []) as unknown as FitScoreResult["evidence_sources"],
        flags: [],
      };

      let draftResult = await llm.draftDM(profile, fitResult, segment, senderCtx);

      // Run guardrails
      const validation = validateDraft(draftResult, profile);

      if (!validation.valid) {
        // One retry with feedback
        try {
          draftResult = await llm.draftDM(profile, fitResult, segment, senderCtx);
          const retryValidation = validateDraft(draftResult, profile);
          if (!retryValidation.valid) {
            // Store the draft anyway but flag it
            await db
              .update(prospects)
              .set({
                draftMessage: `[NEEDS REVIEW] ${draftResult.draft_message}`,
                draftEditedBy: "llm",
                status: "DRAFTED",
                updatedAt: new Date().toISOString(),
              })
              .where(eq(prospects.id, prospect.id))
              .run();
            results.push({
              id: prospect.id,
              status: "drafted_with_warnings",
              draft: draftResult.draft_message,
              errors: retryValidation.errors,
            });
            continue;
          }
        } catch {
          // If retry fails, flag original and continue safely
          await db
            .update(prospects)
            .set({
              draftMessage: `[NEEDS REVIEW] ${draftResult.draft_message}`,
              draftEditedBy: "llm",
              status: "DRAFTED",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(prospects.id, prospect.id))
            .run();
          results.push({
            id: prospect.id,
            status: "drafted_with_warnings",
            draft: draftResult.draft_message,
            errors: validation.errors,
          });
          continue;
        }
      }

      await db
        .update(prospects)
        .set({
          draftMessage: draftResult.draft_message,
          draftEditedBy: "llm",
          status: "DRAFTED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(prospects.id, prospect.id))
        .run();

      results.push({ id: prospect.id, status: "drafted", draft: draftResult.draft_message });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ id: prospect.id, status: "error", errors: [errMsg] });
    }
  }

  const drafted = results.filter(
    (r) => r.status === "drafted" || r.status === "drafted_with_warnings"
  ).length;
  return NextResponse.json({ drafted, results });
}
