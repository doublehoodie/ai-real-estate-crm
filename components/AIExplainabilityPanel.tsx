"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { Lead } from "@/types/lead";
import { computeAiScoreFromBreakdown } from "@/lib/scoring";

type AIExplainabilityPanelProps = {
  lead: Partial<Lead> | null | undefined;
  compact?: boolean;
  className?: string;
};

type ContradictionItem = {
  field: string;
  notes_value: string;
  email_value: string;
  reason: string;
};

export function AIExplainabilityPanel({ lead, compact = false, className = "" }: AIExplainabilityPanelProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(!compact);
  const [showConfidenceWhy, setShowConfidenceWhy] = useState(false);
  const [showContradictions, setShowContradictions] = useState(false);

  const signalsRecord = useMemo(() => asRecord(lead?.ai_signals), [lead?.ai_signals]);
  const structured = useMemo(
    () => asRecord(signalsRecord?.structured_extraction) ?? signalsRecord,
    [signalsRecord],
  );

  const scoreBreakdown = asRecord(lead?.ai_score_breakdown);
  const computedScore = useMemo(() => computeAiScoreFromBreakdown(scoreBreakdown), [scoreBreakdown]);
  const displayAiScore = computedScore ?? (lead?.ai_processed === true ? 0 : toNumberOrNull(lead?.ai_score));
  console.log("FINAL SCORE USED:", displayAiScore ?? lead?.ai_score ?? null);
  const confidence = toNumberOrNull(lead?.ai_confidence);
  console.log("[SCORE DEBUG]", {
    ai_score: lead?.ai_score ?? null,
    displayAiScore,
    breakdown: scoreBreakdown,
    computedScore,
  });

  const confidenceReasoning = toStringArray(
    signalsRecord?.confidence_reasoning ?? structured?.confidence_reasoning,
  );
  const contradictions = toContradictions(
    signalsRecord?.contradictions ?? structured?.contradictions,
  );
  const intentTemporalShift = toStringOrNull(structured?.intent_temporal_shift);
  const hasContradictions = Boolean(lead?.has_contradictions) || contradictions.length > 0;

  const scoreTone =
    (displayAiScore ?? 0) >= 70
      ? "text-green-600 dark:text-emerald-400"
      : (displayAiScore ?? 0) >= 40
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-blue-700 dark:text-blue-400";
  const confidenceBadge = getConfidenceBadge(confidence);

  const budgetPoints = toNumberOrZero(scoreBreakdown?.budget);
  const timelinePoints = toNumberOrZero(scoreBreakdown?.timeline);
  const intentPoints = toNumberOrZero(scoreBreakdown?.intent);
  const urgencyPoints = toNumberOrZero(scoreBreakdown?.urgency);
  const hasAiScore = toNumberOrNull(lead?.ai_score) != null;
  const hasBreakdown =
    toNumberOrNull(scoreBreakdown?.budget) != null ||
    toNumberOrNull(scoreBreakdown?.timeline) != null ||
    toNumberOrNull(scoreBreakdown?.intent) != null ||
    toNumberOrNull(scoreBreakdown?.urgency) != null;
  const showMissingBreakdownWarning = hasAiScore && !hasBreakdown;

  const keySignalBudget = toNumberOrNull(structured?.budget);
  const keySignalTimeline = toStringOrNull(structured?.timeline);
  const keySignalIntent = toStringOrNull(structured?.intent_level ?? lead?.ai_intent_level);
  const keySignalUrgency = toStringOrNull(structured?.urgency);

  if (!lead) return null;

  const leadId = typeof lead.id === "string" && lead.id.length > 0 ? lead.id : null;

  return (
    <div className={`space-y-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-2xl font-bold ${scoreTone}`}>Score: {displayAiScore ?? "—"}</div>
          <div className="text-xs text-slate-700 dark:text-slate-300">Lead Strength</div>
        </div>
        {leadId ? (
          <button
            type="button"
            onClick={() => router.push(`/leads/${leadId}`)}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-slate-300"
            title="View Lead Details"
            aria-label="View Lead Details"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${confidenceBadge.className}`}>
          {confidenceBadge.label}
        </span>
        {compact && (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="rounded-lg border border-slate-200 dark:border-neutral-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            {showDetails ? "Hide Details" : "View Details"}
          </button>
        )}
      </div>

      {showMissingBreakdownWarning && (
        <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-3 text-sm text-yellow-300">
          Score exists, but breakdown data is missing.
        </div>
      )}

      <div
        className={`overflow-hidden transition-all duration-200 ${
          showDetails ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-4 pt-1">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Score Breakdown</div>
            {hasBreakdown ? (
              <div className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Budget</span>
                  <span>+{budgetPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span>Timeline</span>
                  <span>+{timelinePoints}</span>
                </div>
                <div className="flex justify-between">
                  <span>Intent</span>
                  <span>+{intentPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span>Urgency</span>
                  <span>+{urgencyPoints}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No breakdown available</p>
            )}
          </div>

          {intentTemporalShift && (
            <div className="rounded-lg border-l-4 border-sky-400 bg-sky-500/10 p-3 text-sm text-sky-200">
              <div className="mb-1 font-semibold">Intent over time</div>
              <p className="m-0 leading-relaxed">{intentTemporalShift}</p>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowConfidenceWhy((v) => !v)}
              className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Why this confidence? {showConfidenceWhy ? "▲" : "▼"}
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                showConfidenceWhy ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
              }`}
            >
              {confidenceReasoning.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                  {confidenceReasoning.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No confidence reasoning available.</p>
              )}
            </div>
          </div>

          {hasContradictions && (
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-3">
              <div className="mb-1 text-sm font-semibold text-yellow-800 dark:text-amber-200">Conflicting Information Detected</div>
              <button
                type="button"
                onClick={() => setShowContradictions((v) => !v)}
                className="text-xs font-medium text-yellow-800 dark:text-amber-300 hover:text-yellow-900 dark:hover:text-amber-200"
              >
                {showContradictions ? "Hide conflicts ▲" : "View conflicts ▼"}
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  showContradictions ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
                }`}
              >
                {contradictions.length > 0 ? (
                  <div className="space-y-2">
                    {contradictions.map((c, idx) => (
                      <div key={`${c.field}-${idx}`} className="rounded-md border border-amber-300/30 bg-amber-50 dark:bg-neutral-900 p-2 text-xs text-yellow-800 dark:text-amber-100">
                        <div><strong>Field:</strong> {c.field || "—"}</div>
                        <div><strong>Notes:</strong> {c.notes_value || "—"}</div>
                        <div><strong>Email:</strong> {c.email_value || "—"}</div>
                        <div><strong>Reason:</strong> {c.reason || "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-yellow-800 dark:text-amber-300">Contradiction flag is set, but details are unavailable.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">AI Summary</div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{lead.ai_summary?.trim() || "No AI summary available."}</p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Key Signals</div>
            <div className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Budget</span>
                <span>{keySignalBudget != null ? `$${Math.round(keySignalBudget).toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Timeline</span>
                <span>{keySignalTimeline ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Intent</span>
                <span>{formatLevel(keySignalIntent) ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Urgency</span>
                <span>{formatLevel(keySignalUrgency) ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getConfidenceBadge(confidence: number | null): { label: string; className: string } {
  if (confidence == null) {
    return { label: "Low Confidence", className: "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300" };
  }
  if (confidence >= 0.8) return { label: "High Confidence", className: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" };
  if (confidence >= 0.5) return { label: "Medium Confidence", className: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" };
  return { label: "Low Confidence", className: "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300" };
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function formatLevel(value: string | null): string | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  if (v === "low") return "Low";
  return value;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toContradictions(value: unknown): ContradictionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((v): v is Record<string, unknown> => Boolean(v))
    .map((v) => ({
      field: toStringOrNull(v.field) ?? "",
      notes_value: toStringOrNull(v.notes_value) ?? "",
      email_value: toStringOrNull(v.email_value) ?? "",
      reason: toStringOrNull(v.reason) ?? "",
    }))
    .filter((v) => v.field || v.reason || v.notes_value || v.email_value);
}
