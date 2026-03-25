export type LeadScoreConfidence = "low" | "medium" | "high";

export type LeadScoreBreakdown = {
  financialReadiness: number;
  urgency: number;
  behavioralIntent: number;
  fitReadiness: number;
  dataConfidence: number;
};

export interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  timeline: string | null;
  score: number | null;
  score_breakdown: LeadScoreBreakdown | null;
  score_explanation: string[] | null;
  status: string | null;
  notes: string | null;
  /** When absent or null, treat as not favorited (UI-only until persisted). */
  is_favorite?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}
