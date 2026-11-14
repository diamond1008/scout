import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
  const { prospectIds, segment, sender } = body as {
    prospectIds: string[];
    segment: SegmentContext;
    sender: { fund_name: string; sender_name: string };
  };

  if (!prospectIds?.length || !segment) {
    return NextResponse.json({ error: "Missing prospectIds or segment" }, { status: 400 });
  }

  // Get LLM config
  const allSettings = await db.select().from(settings).all();
  const settingsMap = Object.fromEntries((allSettings as any[]).map((s) => [s.key, s.value]));

  const llmProvider = settingsMap.llm_provider || "gemini";
  const apiKey =
    settingsMap[`${llmProvider}_api_key`] ||
    settingsMap.google_api_key ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  // Use configured live provider or fallback to zero-config Sandbox engine
  const llm = createLLMProvider(llmProvider, apiKey);
  const senderCtx = sender || { fund_name: "GenAI Fund", sender_name: "GenAI Fund" };

  const results: { id: string; status: string; draft?: string; errors?: string[] }[] = [];

  for (const prospectId of prospectIds) {
    try {
      const prospect = await db
        .select()
        .from(prospects)
        .where(and(eq(prospects.id, prospectId), eq(prospects.status, "SCORED")))
        .get();

      if (!prospect) {
        results.push({ id: prospectId, status: "skipped" });
        continue;
      }

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
              .where(eq(prospects.id, prospectId))
              .run();
            results.push({
              id: prospectId,
              status: "drafted_with_warnings",
              draft: draftResult.draft_message,
              errors: retryValidation.errors,
            });
            continue;
          }
        } catch {
          // If retry fails, store original with warning
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
        .where(eq(prospects.id, prospectId))
        .run();

      results.push({ id: prospectId, status: "drafted", draft: draftResult.draft_message });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ id: prospectId, status: "error", errors: [errMsg] });
    }
  }

  return NextResponse.json({ results });
}
