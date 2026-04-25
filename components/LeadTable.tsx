"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/types/lead";
import { scoreColorsFromAiScore } from "@/lib/ui/scoreColors";
import { aiConfidenceTier } from "@/lib/leadConfidence";
import { LeadFollowUpPanel } from "@/components/LeadFollowUpPanel";
import { inputFieldClassAuto } from "@/lib/ui";

type LeadTableProps = {
  leads: Lead[] | null;
};

type SortKey = "name" | "timeline" | "ai_score";

export function LeadTable({ leads }: LeadTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Hot" | "Warm" | "Cold">("all");
  const [openFollowUpFor, setOpenFollowUpFor] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ai_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const allLeads = leads ?? [];

    const filtered = allLeads.filter((lead) => {
      const tierLabel = scoreColorsFromAiScore(lead.ai_score).label.toLowerCase();
      const matchesStatus = statusFilter === "all" || tierLabel === statusFilter.toLowerCase();

      const query = search.trim().toLowerCase();
      if (!query) return matchesStatus;

      const haystack = [
        lead.name,
        lead.email,
        lead.phone,
        lead.budget,
        lead.timeline,
        lead.status,
        lead.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(query);
    });

    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (typeof va === "number" && typeof vb === "number") {
        return sortOrder === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [leads, search, statusFilter, sortKey, sortOrder]);

  function handleSortHeader(key: SortKey) {
    if (key === sortKey) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "ai_score" ? "desc" : "asc");
    }
  }

  function toggleScoreDetail(leadId: string) {
    setExpandedLeadId((current) => (current === leadId ? null : leadId));
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur transition-all duration-200 ease-out hover:scale-[1.01]">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Leads</h2>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`min-w-[180px] max-w-xs ${inputFieldClassAuto}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={`min-w-[140px] ${inputFieldClassAuto}`}
          >
            <option value="all">All statuses</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </select>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <SortHeaderButton
                label="Name"
                active={sortKey === "name"}
                sortOrder={sortOrder}
                onClick={() => handleSortHeader("name")}
              />
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <SortHeaderButton
                label="Timeline"
                active={sortKey === "timeline"}
                sortOrder={sortOrder}
                onClick={() => handleSortHeader("timeline")}
              />
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <SortHeaderButton
                label="Score"
                active={sortKey === "ai_score"}
                sortOrder={sortOrder}
                onClick={() => handleSortHeader("ai_score")}
              />
            </th>
            <th style={headerCellStyle} className="text-slate-600 dark:text-slate-400">Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const scoreNum =
              typeof lead.ai_score === "number" && Number.isFinite(lead.ai_score)
                ? Math.round(lead.ai_score)
                : null;
            const colors = scoreColorsFromAiScore(scoreNum);
            const expanded = expandedLeadId === lead.id;

            return (
              <Fragment key={lead.id}>
                <tr
                  className="cursor-pointer border-b border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white transition-colors duration-200 ease-out hover:bg-slate-100 dark:hover:bg-neutral-800"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <td style={cellStyle}>{lead.name ?? "—"}</td>
                  <td style={cellStyle}>{getDisplayTimeline(lead)}</td>
                  <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleScoreDetail(lead.id)}
                      aria-expanded={expanded}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left text-[13px] font-bold leading-none transition-opacity hover:opacity-90 ${colors.pillClass}`}
                      style={{ cursor: "pointer" }}
                    >
                      <span>{scoreNum ?? "—"}</span>
                      <span style={{ opacity: 0.85, fontWeight: 700 }}>{colors.label}</span>
                      <span className="text-[11px] font-semibold opacity-80" aria-hidden>
                        {expanded ? "▲" : "▼"}
                      </span>
                    </button>
                  </td>
                  <td style={{ ...cellStyle, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFollowUpFor((current) => (current === lead.id ? null : lead.id))
                      }
                      className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 shadow-sm transition duration-200 ease-out hover:scale-[1.01] hover:bg-green-600 hover:text-white"
                    >
                      Follow-up
                    </button>
                    {openFollowUpFor === lead.id && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "48px",
                          zIndex: 10,
                          width: "420px",
                          maxWidth: "min(420px, 82vw)",
                        }}
                      >
                        <LeadFollowUpPanel lead={lead} />
                      </div>
                    )}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800">
                    <td colSpan={4} style={expandedCellStyle}>
                      <LeadScoreExpandable lead={lead} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...cellStyle, textAlign: "center", padding: "24px" }} className="text-slate-500 dark:text-slate-400">
                No leads found. Adjust your filters or add a new lead.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function breakdownPoint(bd: Lead["ai_score_breakdown"], key: "budget" | "timeline" | "intent" | "urgency"): number | null {
  if (!bd || typeof bd !== "object") return null;
  const v = (bd as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function LeadScoreExpandable({ lead }: { lead: Lead }) {
  const bd = lead.ai_score_breakdown;
  const budgetPts = breakdownPoint(bd, "budget");
  const timelinePts = breakdownPoint(bd, "timeline");
  const intentPts = breakdownPoint(bd, "intent");
  const urgencyPts = breakdownPoint(bd, "urgency");
  const hasBreakdown = [budgetPts, timelinePts, intentPts, urgencyPts].some((x) => x !== null);

  const tier = aiConfidenceTier(lead.ai_confidence);
  const contradictions = extractContradictions(lead);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confidence</span>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tier.className}`}>
          {tier.label}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Score breakdown</div>
        {hasBreakdown ? (
          <div className="grid max-w-md gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            {budgetPts !== null ? (
              <div className="flex justify-between border-b border-slate-200 dark:border-neutral-800 py-0.5">
                <span>Budget</span>
                <span className="font-medium">+{budgetPts}</span>
              </div>
            ) : null}
            {timelinePts !== null ? (
              <div className="flex justify-between border-b border-slate-200 dark:border-neutral-800 py-0.5">
                <span>Timeline</span>
                <span className="font-medium">+{timelinePts}</span>
              </div>
            ) : null}
            {intentPts !== null ? (
              <div className="flex justify-between border-b border-slate-200 dark:border-neutral-800 py-0.5">
                <span>Intent</span>
                <span className="font-medium">+{intentPts}</span>
              </div>
            ) : null}
            {urgencyPts !== null ? (
              <div className="flex justify-between py-0.5">
                <span>Urgency</span>
                <span className="font-medium">+{urgencyPts}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No breakdown available.</p>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Why this score</div>
        <p className="m-0 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {lead.ai_summary?.trim() || "No AI summary available yet."}
        </p>
      </div>

      {(lead.has_contradictions || contradictions.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3">
          <div className="mb-2 text-sm font-semibold text-amber-900">Conflicts</div>
          {contradictions.length > 0 ? (
            <ul className="m-0 list-none space-y-2 p-0">
              {contradictions.map((c, idx) => (
                <li
                  key={`${c.field}-${idx}`}
                  className="rounded-md border border-amber-300/40 dark:border-amber-700/40 bg-amber-50 dark:bg-neutral-900 p-2 text-xs text-amber-800 dark:text-amber-200"
                >
                  {c.field ? (
                    <div>
                      <strong>Field:</strong> {c.field}
                    </div>
                  ) : null}
                  {c.reason ? (
                    <div className="mt-0.5">
                      <strong>Reason:</strong> {c.reason}
                    </div>
                  ) : null}
                  {c.notes_value ? (
                    <div className="mt-0.5 text-amber-900/90">
                      <strong>Notes:</strong> {c.notes_value}
                    </div>
                  ) : null}
                  {c.email_value ? (
                    <div className="mt-0.5 text-amber-900/90">
                      <strong>Email:</strong> {c.email_value}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-amber-800">Potential conflicting information flagged for this lead.</p>
          )}
        </div>
      )}
    </div>
  );
}

type ContradictionRow = { field: string; notes_value: string; email_value: string; reason: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractContradictions(lead: Lead): ContradictionRow[] {
  const signals = lead.ai_signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return [];
  const rec = signals as Record<string, unknown>;
  const structured = rec.structured_extraction;
  const bucket =
    structured && typeof structured === "object" && !Array.isArray(structured)
      ? (structured as Record<string, unknown>)
      : rec;
  const raw = bucket.contradictions ?? rec.contradictions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => asRecord(item))
    .filter((v): v is Record<string, unknown> => Boolean(v))
    .map((v) => ({
      field: typeof v.field === "string" ? v.field : "",
      notes_value: typeof v.notes_value === "string" ? v.notes_value : "",
      email_value: typeof v.email_value === "string" ? v.email_value : "",
      reason: typeof v.reason === "string" ? v.reason : "",
    }))
    .filter((v) => v.field || v.reason || v.notes_value || v.email_value);
}

const headerCellStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const headerButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const titleCaseHeaderCellStyle: React.CSSProperties = {
  ...headerCellStyle,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: "14px",
};

function SortHeaderButton({
  label,
  active,
  sortOrder,
  onClick,
}: {
  label: string;
  active: boolean;
  sortOrder: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
      {label}
      {active ? <span aria-hidden>{sortOrder === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

function sortValue(lead: Lead, key: SortKey): number | string {
  switch (key) {
    case "ai_score":
      return typeof lead.ai_score === "number" && Number.isFinite(lead.ai_score) ? lead.ai_score : -Infinity;
    case "name":
      return (lead.name ?? "").toLowerCase();
    case "timeline":
      return getDisplayTimeline(lead).toLowerCase();
    default:
      return "";
  }
}

function getDisplayTimeline(lead: Lead): string {
  const direct = lead.timeline?.trim();
  if (direct) return direct;

  const signals = lead.ai_signals;
  if (signals && typeof signals === "object" && !Array.isArray(signals)) {
    const rec = signals as Record<string, unknown>;
    const structured = rec.structured_extraction;
    const bucket =
      structured && typeof structured === "object" && !Array.isArray(structured)
        ? (structured as Record<string, unknown>)
        : rec;
    const t = bucket.timeline;
    if (typeof t === "string" && t.trim()) return t.trim();
  }

  return "—";
}

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "16px 16px",
  textAlign: "left",
  fontSize: "14px",
  verticalAlign: "middle",
};

const expandedCellStyle: React.CSSProperties = {
  padding: "16px 16px 20px",
  verticalAlign: "top",
  background: "transparent",
};
