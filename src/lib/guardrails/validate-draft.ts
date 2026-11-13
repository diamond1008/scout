import type { UserProfile, TweetData } from "../providers/x/types";
import type { DraftResult } from "../providers/llm/types";

const BANNED_PHRASES = [
  "pick your brain",
  "stumbled upon",
  "came across your amazing",
  "thought leader",
  "synergy",
  "circle back",
  "low-hanging fruit",
  "touch base",
  "deep dive into",
  "leverage your expertise",
  "paradigm shift",
  "move the needle",
  "I'm a huge fan",
  "I've been following your work",
];

const FAMILIARITY_PATTERNS = [
  /we met at/i,
  /great meeting you/i,
  /as we discussed/i,
  /as per our conversation/i,
  /following up on our/i,
  /nice to meet you at/i,
  /remember when we/i,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Post-LLM guardrail: validates a draft DM against evidence grounding,
 * length, tone, and anti-hallucination rules.
 */
export function validateDraft(
  draft: DraftResult,
  profile: UserProfile
): ValidationResult {
  const errors: string[] = [];

  // 1. Evidence grounding check — the cited quote must exist in real data
  if (draft.evidence_used?.quote) {
    const allText = [
      profile.bio || "",
      ...profile.recent_tweets.map((t: TweetData) => t.text),
      profile.pinned_tweet?.text || "",
    ].join(" ");

    // Check for substantial substring match (at least 10 chars of the quote)
    const quote = draft.evidence_used.quote;
    if (quote.length > 10 && !allText.includes(quote)) {
      // Try fuzzy: check if any significant portion matches
      const words = quote.split(/\s+/).filter((w: string) => w.length > 3);
      const matchCount = words.filter((w: string) => allText.toLowerCase().includes(w.toLowerCase())).length;
      if (matchCount < words.length * 0.5) {
        errors.push(
          `HALLUCINATION: Draft cites evidence "${quote.slice(0, 60)}..." not found in fetched profile data`
        );
      }
    }
  }

  // 2. Length check
  const charCount = draft.draft_message.length;
  if (charCount > 500) {
    errors.push(`TOO_LONG: ${charCount} chars (max 500)`);
  }

  // 3. Banned phrases
  const messageLower = draft.draft_message.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (messageLower.includes(phrase.toLowerCase())) {
      errors.push(`BANNED_PHRASE: "${phrase}"`);
    }
  }

  // 4. Invented familiarity
  for (const pattern of FAMILIARITY_PATTERNS) {
    if (pattern.test(draft.draft_message)) {
      errors.push(`INVENTED_FAMILIARITY: Draft implies prior interaction (matched: ${pattern})`);
    }
  }

  // 5. Must mention fund name
  if (
    !draft.draft_message.toLowerCase().includes("genai fund") &&
    !draft.draft_message.toLowerCase().includes("genai")
  ) {
    errors.push("MISSING_IDENTITY: Draft should mention GenAI Fund");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
