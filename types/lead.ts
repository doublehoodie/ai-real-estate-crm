export type LeadScoreConfidence = "low" | "medium" | "high";

export type LeadScoreBreakdown = {
  financialReadiness: number;
  urgency: number;
  behavioralIntent: number;
  fitReadiness: number;
  dataConfidence: number;
};

export type LeadAiNextAction = {
  action: string;
  priority: "low" | "medium" | "high";
  reason: string;
};

export type LeadAiSignals = {
  financial_readiness: string[];
  urgency: string[];
  intent: string[];
  fit: string[];
  objections: string[];
  missing_info: string[];
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
  /**
   * @deprecated Legacy DB columns — do not read or write in app logic. Use `ai_score` / `ai_score_breakdown`.
   */
  score?: number | null;
  /** @deprecated See `ai_score_breakdown`. */
  score_breakdown?: LeadScoreBreakdown | null;
  /** @deprecated Not used; AI context uses `ai_summary` / signals. */
  score_explanation?: string[] | null;
  status: string | null;
  notes: string | null;
  /** When absent or null, treat as not favorited (UI-only until persisted). */
  is_favorite?: boolean | null;
  ai_summary?: string | null;
  ai_intent_level?: string | null;
  ai_score?: number | null;
  ai_score_breakdown?: {
    budget: number;
    timeline: number;
    intent: number;
    urgency: number;
  } | null;
  ai_confidence?: number | null;
  ai_signals?: LeadAiSignals | Record<string, unknown> | null;
  ai_next_action?: LeadAiNextAction | Record<string, unknown> | null;
  ai_followup?: string | null;
  has_contradictions?: boolean | null;
  ai_processed?: boolean | null;
  needs_action?: boolean | null;
  last_contact_at?: string | null;
  /** Set when AI qualification last completed successfully; used to detect new emails and re-run AI. */
  ai_last_processed_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}
