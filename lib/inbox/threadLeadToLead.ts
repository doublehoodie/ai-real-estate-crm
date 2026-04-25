import type { InboxThreadSummary } from "@/types/inbox";
import type { Lead } from "@/types/lead";

/** Expands thread-scoped lead pick to a `Lead` for stores and APIs. */
export function threadLeadToLead(lead: NonNullable<InboxThreadSummary["lead"]>): Lead {
  return {
    id: lead.id,
    user_id: undefined,
    name: lead.name,
    email: lead.email,
    phone: null,
    budget: null,
    budget_value: null,
    timeline: null,
    status: null,
    notes: null,
    is_favorite: null,
    ai_summary: lead.ai_summary ?? null,
    ai_intent_level: lead.ai_intent_level ?? null,
    ai_score: lead.ai_score ?? null,
    ai_score_breakdown: lead.ai_score_breakdown ?? null,
    ai_confidence: lead.ai_confidence ?? null,
    ai_signals: lead.ai_signals ?? null,
    ai_next_action: lead.ai_next_action ?? null,
    ai_followup: lead.ai_followup ?? null,
    has_contradictions: lead.has_contradictions ?? null,
    ai_processed: lead.ai_processed ?? null,
    needs_action: null,
    last_contact_at: null,
    ai_last_processed_at: null,
    created_at: null,
    updated_at: null,
  };
}
