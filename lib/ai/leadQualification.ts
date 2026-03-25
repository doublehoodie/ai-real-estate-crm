import type { Lead } from "@/types/lead";

export type LeadQualificationInput = {
  lead: Partial<Lead>;
  rawTranscript?: string;
  notes?: string;
};

export type LeadQualificationSuggestion = {
  suggestedBudget?: string | null;
  suggestedTimeline?: string | null;
  suggestedScore?: number | null;
  reasoning?: string;
};

/**
 * Placeholder for future AI-powered lead qualification.
 *
 * In the future, this function will call an LLM to:
 * - analyze raw lead text or conversation transcripts
 * - extract budget, timeline, and intent
 * - suggest an updated lead score and status
 */
export async function suggestLeadQualification(
  _input: LeadQualificationInput,
): Promise<LeadQualificationSuggestion> {
  void _input;

  // For now we simply return an empty suggestion so the rest of the app
  // can depend on this function without introducing AI complexity yet.
  return {};
}
