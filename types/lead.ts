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
  /** Owning CRM user (auth.users.id); required on insert. */
  user_id?: string | null;
  name: string | null;
  email: string | null;
  /** Free-form or E.164-style; always string | null from DB/API (never a number). */
  phone: string | null;
  budget: string | null;
  /** Derived from `budget` when parsing is unambiguous; null otherwise. */
  budget_value?: number | null;
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
