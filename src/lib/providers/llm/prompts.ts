import { z } from "zod";

// ── Scoring system prompt ──────────────────────────────────────────────────

export const SCORING_SYSTEM_PROMPT = `You are a venture capital analyst for GenAI Fund, a VC fund focused on AI infrastructure, developer tools, embodied AI, and robotics — especially builders in Southeast Asia.

Given a target segment description and a candidate's X/Twitter profile, score how relevant this person is as a potential founder, builder, or researcher to connect with.

RULES:
- Score ONLY based on the provided evidence. Never invent or assume facts.
- Every piece of reasoning MUST cite a specific evidence_source.
- fit_score is 0.0 to 1.0 (0.7+ = strong fit, 0.4-0.7 = moderate, <0.4 = weak).
- Be concise and specific in fit_reasoning.
- Consider: founder/builder signal, technical depth, geographic relevance (SEA), topic alignment, community influence.`;

// ── Drafting system prompt ─────────────────────────────────────────────────

export const DRAFTING_SYSTEM_PROMPT = `You are drafting a short, warm, personalised Direct Message on X/Twitter on behalf of GenAI Fund — a VC fund backing AI-native startups (pre-seed to Series A) especially in Southeast Asia.

RULES:
- The DM must be 2-4 sentences. Aim for under 280 characters; never exceed 500.
- Reference ONE specific thing from their profile or recent tweets that genuinely caught your attention. Cite the exact evidence.
- Be genuine and conversational. No salesy language, no "I stumbled upon your profile", no "I'd love to pick your brain".
- State clearly who you are (GenAI Fund) and what you're interested in.
- End with a low-pressure question or soft CTA.
- NEVER invent or assume any fact not present in the provided context.
- NEVER claim a personal connection or prior interaction that doesn't exist.
- Keep the tone natural — like a thoughtful peer, not a template.`;

// ── Zod schemas for structured output ──────────────────────────────────────

export const evidenceSourceSchema = z.object({
  type: z.enum(["bio", "tweet"]),
  tweet_id: z.string().optional(),
  quote: z.string().describe("Verbatim quote from the bio or tweet text"),
  relevance: z.string().describe("Why this evidence is relevant to the fit assessment"),
});

export const fitScoreSchema = z.object({
  fit_score: z
    .number()
    .min(0)
    .max(1)
    .describe("0.0-1.0 relevance score. 0.7+ strong, 0.4-0.7 moderate, <0.4 weak"),
  fit_reasoning: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Concise bullet points explaining the score, each citing evidence"),
  evidence_sources: z
    .array(evidenceSourceSchema)
    .min(1)
    .max(6)
    .describe("Specific evidence from bio/tweets that supports the reasoning"),
  flags: z
    .array(z.string())
    .describe("Any red flags or concerns (empty array if none)"),
});

export const draftResultSchema = z.object({
  draft_message: z
    .string()
    .max(500)
    .describe("The personalised DM text, 2-4 sentences"),
  evidence_used: evidenceSourceSchema.describe(
    "The single piece of evidence referenced in the DM"
  ),
  tone_check: z.object({
    is_salesy: z.boolean().describe("True if the draft uses salesy/template language"),
    mentions_specific_evidence: z.boolean().describe("True if the draft references real evidence"),
    character_count: z.number().describe("Character count of draft_message"),
    within_limit: z.boolean().describe("True if under 500 characters"),
  }),
});

export type FitScoreOutput = z.infer<typeof fitScoreSchema>;
export type DraftResultOutput = z.infer<typeof draftResultSchema>;
