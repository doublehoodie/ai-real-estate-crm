import type { AssistantActionRecommendation } from "@/lib/ai/assistantSurfaceTypes";

/** Minimum AI score for the high-priority structured follow-up card. */
export const ASSISTANT_HIGH_SCORE_THRESHOLD = 70;

export type DecisionLead = {
  id: string;
  name: string;
  ai_score: number;
  lastContactDate: string;
  status?: string | null;
  aiSummary?: string | null;
};

type ApiLeadRow = {
  id?: string;
  name?: string | null;
  ai_score?: number | null;
  last_contact_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  ai_summary?: string | null;
};

export function mapApiLeadsToDecisionLeads(rows: ApiLeadRow[] | undefined): DecisionLead[] {
  return (rows ?? [])
    .filter((lead) => typeof lead.id === "string" && lead.id.length > 0)
    .map((lead) => ({
      id: lead.id as string,
      name: (lead.name ?? "Untitled lead").trim() || "Untitled lead",
      ai_score: typeof lead.ai_score === "number" ? lead.ai_score : 0,
      lastContactDate: lead.last_contact_at ?? lead.updated_at ?? "",
      status: lead.status ?? null,
      aiSummary: lead.ai_summary ?? null,
    }));
}

/**
 * Same rules as the in-hook decision layer: top score ≥ 70 → structured follow-up card.
 */
export function buildStructuredRecommendation(leads: DecisionLead[]): AssistantActionRecommendation | null {
  if (leads.length === 0) return null;
  const bestLead = [...leads].sort((a, b) => b.ai_score - a.ai_score)[0];
  if (!bestLead || bestLead.ai_score < ASSISTANT_HIGH_SCORE_THRESHOLD) return null;

  const formattedDate = bestLead.lastContactDate
    ? new Date(bestLead.lastContactDate).toLocaleDateString()
    : "Unknown";
  const now = new Date();
  const lastContact = new Date(bestLead.lastContactDate);
  const daysDiff = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
  const isRecent = Number.isFinite(daysDiff) && daysDiff <= 7;

  const timingText = isRecent
    ? "Fresh activity — keep momentum with a clear next step."
    : "Momentum is fading — re-open the thread with a concise check-in.";

  return {
    type: "action_recommendation",
    leadId: bestLead.id,
    title: `Follow up with ${bestLead.name}`,
    subtitle: `Score: ${bestLead.ai_score} • Last contacted ${formattedDate}`,
    description: timingText,
    steps: [
      { label: "View lead", action: "view_lead" },
      { label: "Ask for status", action: "draft_message" },
      { label: "Schedule meeting", action: "schedule_meeting" },
    ],
    primaryAction: {
      label: "Draft follow-up",
      action: "draft_message",
    },
  };
}

export function recommendationFingerprint(rec: AssistantActionRecommendation): string {
  return `${rec.leadId}|${rec.title}|${rec.subtitle}`;
}
