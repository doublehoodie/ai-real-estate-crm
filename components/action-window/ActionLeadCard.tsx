"use client";

import type { Lead, LeadAiNextAction } from "@/types/lead";
import { aiConfidenceTier } from "@/lib/leadConfidence";
import { formatLeadSummaryShort } from "@/lib/actionWindow/formatLeadSummary";

type ActionLeadCardProps = {
  lead: Lead;
  onSelect: () => void;
};

function scoreDisplay(lead: Lead): string {
  const s = lead.ai_score;
  if (typeof s === "number" && Number.isFinite(s)) return String(Math.round(s));
  return "—";
}

function nextLine(lead: Lead): string | null {
  const na = lead.ai_next_action;
  if (na && typeof na === "object" && !Array.isArray(na)) {
    const action = (na as LeadAiNextAction).action;
    if (typeof action === "string" && action.trim()) return action.trim();
  }
  const bd = lead.ai_score_breakdown;
  if (bd && typeof bd === "object" && typeof (bd as { urgency?: unknown }).urgency === "number") {
    const u = (bd as { urgency: number }).urgency;
    if (u >= 7) return "Elevated urgency signal in score breakdown.";
  }
  return null;
}

export function ActionLeadCard({ lead, onSelect }: ActionLeadCardProps) {
  const tier = aiConfidenceTier(lead.ai_confidence);
  const secondary = nextLine(lead);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-gray-200/90 bg-white p-3.5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug text-gray-900">{lead.name?.trim() || "Untitled lead"}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">{scoreDisplay(lead)}</span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Confidence</span>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tier.className}`}>
          {tier.label}
        </span>
      </div>
      <p className="mb-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{formatLeadSummaryShort(lead.ai_summary)}</p>
      {secondary ? <p className="text-[11px] leading-snug text-gray-500">{secondary}</p> : null}
    </button>
  );
}
