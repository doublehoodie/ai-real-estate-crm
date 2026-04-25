import type { Lead } from "@/types/lead";

/** Normalized intent labels — model output must use exactly one of these. */
export const ALLOWED_INTENTS = [
  "follow_up",
  "schedule_meeting",
  "multi_step",
  "view_only",
  "clarification",
] as const;

export type PlanIntent = (typeof ALLOWED_INTENTS)[number];

export const ALLOWED_ACTIONS = [
  "draft_message",
  "send_message",
  "suggest_time",
  "create_event",
  "update_notes",
  "view_details",
] as const;

export type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

export type ActionPlanStep = {
  action: AllowedAction;
  requiresConfirmation: boolean;
  ui: string;
};

export type ActionPlan = {
  intent: PlanIntent;
  message: string;
  plan: ActionPlanStep[];
};

/** Small, debuggable context for planning (no full threads). */
export type AssistantContext = {
  summary: string | null;
  ai_score: number | null;
  urgency: string | null;
  budget: string | null;
  timeline: string | null;
  lastMessages: { received_at: string; preview: string }[];
  conflicts: boolean | null;
};

/** Optional enrichments not stored on the Lead row; attach in API layer when available. */
export type LeadWithAssistantMessages = Lead & {
  assistantRecentMessages?: { received_at: string; preview: string }[];
};
