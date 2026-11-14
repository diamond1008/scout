import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects, settings } from "@/lib/db/schema";
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
  const { prospectIds, segment } = body as {
    prospectIds: string[];
    segment: SegmentContext;
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

  const results: { id: string; fit_score: number; status: string; error?: string }[] = [];

  for (const prospectId of prospectIds) {
    try {
      const prospect = await db
        .select()
        .from(prospects)
        .where(and(eq(prospects.id, prospectId), eq(prospects.status, "DISCOVERED")))
        .get();

      if (!prospect) {
        results.push({ id: prospectId, fit_score: 0, status: "skipped", error: "Not in DISCOVERED state" });
        continue;
      }

      // Build UserProfile from prospect data
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
        .where(eq(prospects.id, prospectId))
        .run();

      results.push({ id: prospectId, fit_score: scoreResult.fit_score, status: "scored" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ id: prospectId, fit_score: 0, status: "error", error: errMsg });
    }
  }

  return NextResponse.json({ results });
}
