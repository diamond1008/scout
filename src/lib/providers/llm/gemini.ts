import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import type { z } from "zod";
import type { UserProfile } from "../x/types";
import type { ILLMProvider, FitScoreResult, DraftResult, SegmentContext, SenderContext } from "./types";
import {
  SCORING_SYSTEM_PROMPT,
  DRAFTING_SYSTEM_PROMPT,
  fitScoreSchema,
  draftResultSchema,
} from "./prompts";

const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
];

export class GeminiProvider implements ILLMProvider {
  private google;
  private modelCandidates: string[];

  constructor(apiKey: string, modelName: string = "gemini-3.5-flash-lite") {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.modelCandidates = [
      modelName,
      ...GEMINI_FALLBACK_MODELS.filter((m) => m !== modelName),
    ];
  }

  private async generateWithFallback<T>(
    schema: z.ZodType<T>,
    system: string,
    prompt: string
  ): Promise<T> {
    let lastError: unknown;
    for (const modelId of this.modelCandidates) {
      try {
        const { object } = await generateObject({
          model: this.google(modelId),
          schema,
          system,
          prompt,
          maxRetries: 1,
        });
        return object;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
          throw err;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async scoreProfile(profile: UserProfile, segment: SegmentContext): Promise<FitScoreResult> {
    return this.generateWithFallback(
      fitScoreSchema,
      SCORING_SYSTEM_PROMPT,
      JSON.stringify({
        segment: {
          keywords: segment.keywords,
          description: segment.description,
          fund_focus: segment.fund_focus,
        },
        candidate: {
          x_user_id: profile.x_user_id,
          username: profile.username,
          display_name: profile.display_name,
          bio: profile.bio,
          location: profile.location,
          follower_count: profile.follower_count,
          verified: profile.verified,
          recent_tweets: profile.recent_tweets.slice(0, 5),
          pinned_tweet: profile.pinned_tweet,
        },
      })
    );
  }

  async draftDM(
    profile: UserProfile,
    fitResult: FitScoreResult,
    segment: SegmentContext,
    sender: SenderContext
  ): Promise<DraftResult> {
    return this.generateWithFallback(
      draftResultSchema,
      DRAFTING_SYSTEM_PROMPT,
      JSON.stringify({
        sender_context: {
          fund_name: sender.fund_name,
          fund_description: segment.description,
          sender_name: sender.sender_name,
        },
        recipient: {
          display_name: profile.display_name,
          username: profile.username,
          bio: profile.bio,
          recent_tweets: profile.recent_tweets.slice(0, 5),
          pinned_tweet: profile.pinned_tweet,
        },
        fit_score_result: {
          fit_score: fitResult.fit_score,
          fit_reasoning: fitResult.fit_reasoning,
          evidence_sources: fitResult.evidence_sources,
        },
      })
    );
  }
}
