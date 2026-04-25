import type { Lead, LeadAiNextAction } from "@/types/lead";

function nextActionPriorityScore(lead: Lead): number {
  const raw = lead.ai_next_action;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const p = (raw as LeadAiNextAction).priority;
  if (p === "high") return 3;
  if (p === "medium") return 2;
  if (p === "low") return 1;
  return 0;
}

/** Tie-breaker when `urgency_level` is not a lead column: breakdown urgency points + next-action priority. */
function urgencySortKey(lead: Lead): number {
  const bd = lead.ai_score_breakdown;
  const u =
    bd && typeof bd === "object" && typeof (bd as { urgency?: unknown }).urgency === "number"
      ? (bd as { urgency: number }).urgency
      : 0;
  return u * 0.01 + nextActionPriorityScore(lead);
}

function aiScoreValue(lead: Lead): number {
  const s = lead.ai_score;
  return typeof s === "number" && Number.isFinite(s) ? s : Number.NEGATIVE_INFINITY;
}

function getLastContactIso(lead: Lead): string | null {
  const withLastContact = lead as Lead & { last_contact_at?: string | null };
  return withLastContact.last_contact_at ?? lead.created_at ?? null;
}

function leadNeedsAction(lead: Lead): boolean {
  const withNeedsAction = lead as Lead & { needs_action?: boolean | null };
  return withNeedsAction.needs_action === true;
}

export function computePriorityScore(lead: Lead): number {
  const score = typeof lead.ai_score === "number" && Number.isFinite(lead.ai_score) ? lead.ai_score : 0;
  const lastContactIso = getLastContactIso(lead);
  const lastContact = lastContactIso ? new Date(lastContactIso) : new Date();
  const hoursSince = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60);
  const recencyWeight = Math.max(0, 100 - hoursSince);
  const urgency = leadNeedsAction(lead) ? 100 : 0;

  return score * 0.6 + recencyWeight * 0.3 + urgency * 0.1;
}

/**
 * Primary: ai_score descending.
 * Secondary: derived urgency (next-action priority + breakdown urgency) when scores tie.
 */
export function prioritizeLeadsForActionWindow(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const sa = computePriorityScore(a);
    const sb = computePriorityScore(b);
    if (sb !== sa) return sb - sa;
    const aiA = aiScoreValue(a);
    const aiB = aiScoreValue(b);
    if (aiB !== aiA) return aiB - aiA;
    return urgencySortKey(b) - urgencySortKey(a);
  });
}
