import type { AssistantContext, LeadWithAssistantMessages } from "@/lib/ai/actionPlanTypes";

/**
 * Build a compact context object for the planning model.
 * Pass recent message previews via `lead.assistantRecentMessages` (max 2 used).
 */
export function buildAssistantContext(lead: LeadWithAssistantMessages): AssistantContext {
  const raw = lead.assistantRecentMessages ?? [];
  const lastMessages = [...raw]
    .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
    .slice(0, 2)
    .map((m) => ({
      received_at: m.received_at,
      preview: m.preview.trim().slice(0, 400),
    }));

  const urgency =
    (lead as { urgency_level?: string | null }).urgency_level?.trim() ||
    lead.ai_intent_level?.trim() ||
    (typeof lead.ai_score_breakdown?.urgency === "number"
      ? `ai_score_breakdown_urgency:${lead.ai_score_breakdown.urgency}`
      : null);

  return {
    summary: lead.ai_summary?.trim() ?? null,
    ai_score: typeof lead.ai_score === "number" && Number.isFinite(lead.ai_score) ? lead.ai_score : null,
    urgency,
    budget: lead.budget?.trim() ?? null,
    timeline: lead.timeline?.trim() ?? null,
    lastMessages,
    conflicts: lead.has_contradictions ?? null,
  };
}
