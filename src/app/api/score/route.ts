import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { campaigns, prospects, settings } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { GeminiProvider } from "@/lib/providers/llm/gemini";
import { OpenAIProvider } from "@/lib/providers/llm/openai";
import { AnthropicProvider } from "@/lib/providers/llm/anthropic";
import type { ILLMProvider, SegmentContext } from "@/lib/providers/llm/types";
import type { UserProfile } from "@/lib/providers/x/types";
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
  const { campaignId, prospectIds: rawIds, segment: rawSegment } = body as {
    campaignId?: string;
    prospectIds?: string[];
    segment?: SegmentContext;
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
      const discovered = await db
        .select({ id: prospects.id })
        .from(prospects)
        .where(and(eq(prospects.campaignId, campaignId), eq(prospects.status, "DISCOVERED")))
        .all();
      targetIds = discovered.map((p) => p.id);
    }
  }

  if (!segment) {
    return NextResponse.json({ error: "Missing segment context" }, { status: 400 });
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ scored: 0, results: [] });
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
  const rawKey = keyMap[llmProvider] || "";
  const apiKey = rawKey.trim().replace(/^['"]+|['"]+$/g, "");

  // Use configured live provider or fallback to zero-config Sandbox engine
  const llm = createLLMProvider(llmProvider, apiKey);

  const candidateRows = await db
    .select()
    .from(prospects)
    .where(and(inArray(prospects.id, targetIds), eq(prospects.status, "DISCOVERED")))
    .all();

  const results: { id: string; fit_score: number; status: string; error?: string }[] = [];

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

      const scoreResult = await llm.scoreProfile(profile, segment);

      await db
        .update(prospects)
        .set({
          fitScore: scoreResult.fit_score,
          fitReasoning: scoreResult.fit_reasoning.join("\n"),
          evidenceSources: scoreResult.evidence_sources,
          status: "SCORED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(prospects.id, prospect.id))
        .run();

      results.push({ id: prospect.id, fit_score: scoreResult.fit_score, status: "scored" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ id: prospect.id, fit_score: 0, status: "error", error: errMsg });
    }
  }

  const scored = results.filter((r) => r.status === "scored").length;
  return NextResponse.json({ scored, results });
}
