import type { UserProfile } from "../x/types";

export interface EvidenceSource {
  type: "bio" | "tweet";
  tweet_id?: string;
  quote: string;
  relevance: string;
}

export interface FitScoreResult {
  fit_score: number;
  fit_reasoning: string[];
  evidence_sources: EvidenceSource[];
  flags: string[];
}

export interface DraftResult {
  draft_message: string;
  evidence_used: EvidenceSource;
  tone_check: {
    is_salesy: boolean;
    mentions_specific_evidence: boolean;
    character_count: number;
    within_limit: boolean;
  };
}

export interface SegmentContext {
  keywords: string[];
  description: string;
  fund_focus: string;
}

export interface SenderContext {
  fund_name: string;
  sender_name: string;
}

export interface ILLMProvider {
  scoreProfile(profile: UserProfile, segment: SegmentContext): Promise<FitScoreResult>;
  draftDM(
    profile: UserProfile,
    fitResult: FitScoreResult,
    segment: SegmentContext,
    sender: SenderContext
  ): Promise<DraftResult>;
}
