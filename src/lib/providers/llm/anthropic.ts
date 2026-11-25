import { createAnthropic, anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { UserProfile } from "../x/types";
import type { ILLMProvider, FitScoreResult, DraftResult, SegmentContext, SenderContext } from "./types";
import {
  SCORING_SYSTEM_PROMPT,
  DRAFTING_SYSTEM_PROMPT,
  fitScoreSchema,
  draftResultSchema,
} from "./prompts";

export class AnthropicProvider implements ILLMProvider {
  private model;

  constructor(apiKey?: string, modelName: string = "claude-sonnet-4-20250514") {
    if (apiKey) {
      const customAnthropic = createAnthropic({ apiKey });
      this.model = customAnthropic(modelName);
    } else {
      this.model = anthropic(modelName);
    }
  }

  async scoreProfile(profile: UserProfile, segment: SegmentContext): Promise<FitScoreResult> {
    const { object } = await generateObject({
      model: this.model,
      schema: fitScoreSchema,
      system: SCORING_SYSTEM_PROMPT,
      prompt: JSON.stringify({
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
      }),
    });
    return object;
  }

  async draftDM(
    profile: UserProfile,
    fitResult: FitScoreResult,
    segment: SegmentContext,
    sender: SenderContext,
    feedbackErrors?: string[]
  ): Promise<DraftResult> {
    const { object } = await generateObject({
      model: this.model,
      schema: draftResultSchema,
      system: DRAFTING_SYSTEM_PROMPT,
      prompt: JSON.stringify({
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
        ...(feedbackErrors?.length
          ? {
              guardrail_feedback_to_fix: feedbackErrors,
              instruction:
                "Your previous draft failed post-generation guardrails. Rewrite the DM fixing every issue listed in guardrail_feedback_to_fix while citing verbatim evidence and mentioning GenAI Fund.",
            }
          : {}),
      }),
    });
    return object;
  }
}
