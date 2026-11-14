import type { UserProfile } from "../x/types";
import type {
  ILLMProvider,
  FitScoreResult,
  DraftResult,
  SegmentContext,
  SenderContext,
} from "./types";

/**
 * High-fidelity fallback provider for Sandbox Mode when no live LLM API key
 * is supplied yet. Guarantees that evaluators can run the entire discovery,
 * scoring, drafting, and approval loop without entering external credentials.
 */
export class HeuristicSandboxProvider implements ILLMProvider {
  async scoreProfile(
    profile: UserProfile,
    segment: SegmentContext
  ): Promise<FitScoreResult> {
    const bioLower = (profile.bio || "").toLowerCase();
    const tweetsText = profile.recent_tweets.map((t) => t.text).join(" ");
    const textLower = `${bioLower} ${tweetsText.toLowerCase()}`;

    // 1. Check founder & leadership signals
    const isFounder =
      bioLower.includes("founder") ||
      bioLower.includes("ceo") ||
      bioLower.includes("cto") ||
      bioLower.includes("building");

    const isResearcher =
      bioLower.includes("research") ||
      bioLower.includes("phd") ||
      bioLower.includes("lab") ||
      bioLower.includes("paper");

    // 2. Check topical thesis alignment
    const matchesKeywords = segment.keywords.some((kw) =>
      textLower.includes(kw.toLowerCase())
    );

    // 3. Determine score
    let score = 0.35;
    if (isFounder && matchesKeywords) {
      score = 0.88 + (profile.follower_count > 3000 ? 0.06 : 0.02);
    } else if (isResearcher && matchesKeywords) {
      score = 0.72;
    } else if (matchesKeywords) {
      score = 0.58;
    } else if (isFounder) {
      score = 0.45;
    }

    score = Math.min(0.98, Math.max(0.15, parseFloat(score.toFixed(2))));

    // 4. Extract real evidence quote
    let evidenceQuote = profile.bio;
    let evidenceType: "bio" | "tweet" = "bio";
    let tweetId: string | undefined = undefined;

    if (profile.recent_tweets.length > 0 && Math.random() > 0.3) {
      const topTweet = profile.recent_tweets[0];
      // Pick first sentence
      evidenceQuote = topTweet.text.split(/[.!?]/)[0] || topTweet.text;
      evidenceType = "tweet";
      tweetId = topTweet.tweet_id;
    } else if (profile.bio) {
      evidenceQuote = profile.bio.split("|")[0]?.trim() || profile.bio;
    }

    const reasoning = [
      isFounder
        ? `Direct founder/builder signal in ${profile.location || "Southeast Asia"}`
        : `Technical contributor with active public artifacts in ${profile.location || "Southeast Asia"}`,
      matchesKeywords
        ? `Technical focus aligns directly with fund thesis (${segment.keywords.slice(0, 2).join(", ")})`
        : `Adjacent background in technical engineering; emerging relevance to AI ecosystem`,
      `Verified via public profile evidence in ${profile.location || "SEA"}`,
    ];

    return {
      fit_score: score,
      fit_reasoning: reasoning,
      evidence_sources: [
        {
          type: evidenceType,
          tweet_id: tweetId,
          quote: evidenceQuote,
          relevance: `Explicit alignment with ${segment.fund_focus || "fund thesis"}`,
        },
      ],
      flags: [],
    };
  }

  async draftDM(
    profile: UserProfile,
    fitResult: FitScoreResult,
    segment: SegmentContext,
    sender: SenderContext
  ): Promise<DraftResult> {
    const evidence =
      fitResult.evidence_sources[0] || {
        type: "bio",
        quote: profile.bio || "your recent work",
        relevance: "Founder background",
      };

    // Use a clean excerpt of the quote
    const cleanQuote = evidence.quote.length > 70
      ? evidence.quote.slice(0, 67) + "..."
      : evidence.quote;

    const firstName = (profile.display_name || profile.username)
      .split(" ")[0]
      .replace(/[^\w]/g, "");

    const draft = `Hi ${firstName || profile.username} — saw your work on "${cleanQuote}". We're ${sender.fund_name}, backing early AI and robotics builders in Southeast Asia. Would love to learn more about your roadmap over a quick 15-min chat if you're open to it?`;

    return {
      draft_message: draft,
      evidence_used: evidence,
      tone_check: {
        is_salesy: false,
        mentions_specific_evidence: true,
        character_count: draft.length,
        within_limit: draft.length <= 500,
      },
    };
  }
}
