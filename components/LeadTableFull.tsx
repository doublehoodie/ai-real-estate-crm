"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Lead } from "@/types/lead";
import { displayBudgetText } from "@/lib/format";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import { LeadScoreDetails } from "@/components/LeadScoreDetails";
import { LeadFavoriteStar } from "@/components/LeadFavoriteStar";
import { CSVUploader } from "@/components/import/CSVUploader";
import { inputFieldClassAuto } from "@/lib/ui";
import { scoreColorsFromAiScore } from "@/lib/ui/scoreColors";

type LeadTableFullProps = {
  leads: Lead[] | null;
};

type SortKey = "name" | "email" | "phone" | "budget" | "timeline" | "ai_score" | "status" | "created_at";

export function LeadTableFull({ leads }: LeadTableFullProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Hot" | "Warm" | "Cold">("all");
  const [sortKey, setSortKey] = useState<SortKey>("ai_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  /** Optimistic overrides while an update is in flight or until refresh replaces server data. */
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});

  function isFavorite(lead: Lead): boolean {
    const override = favoriteOverrides[lead.id];
    if (override !== undefined) return override;
    return lead.is_favorite === true;
  }

  async function handleToggleFavorite(lead: Lead, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    const current =
      favoriteOverrides[lead.id] !== undefined ? favoriteOverrides[lead.id] : lead.is_favorite === true;
    const next = !current;

    setFavoriteOverrides((prev) => ({ ...prev, [lead.id]: next }));

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      console.error("Favorite toggle user error:", userError);
      setFavoriteOverrides((prev) => ({ ...prev, [lead.id]: current }));
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({ is_favorite: next })
      .eq("id", lead.id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setFavoriteOverrides((prev) => ({ ...prev, [lead.id]: current }));
      return;
    }

    await router.refresh();
    setFavoriteOverrides((prev) => {
      const rest = { ...prev };
      delete rest[lead.id];
      return rest;
    });
  }

  const { rows, totalPages } = useMemo(() => {
    const allLeads = (leads ?? []).slice();

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

    const sorted = filtered.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      const getValue = (lead: Lead) => {
        switch (sortKey) {
          case "name":
          case "email":
          case "phone":
          case "budget":
          case "timeline":
          case "status":
            return (lead[sortKey] ?? "").toString().toLowerCase();
          case "ai_score":
            return lead.ai_score ?? -Infinity;
          case "created_at":
            return lead.created_at ? new Date(lead.created_at).getTime() : 0;
          default:
            return 0;
        }
      };

      const aVal = getValue(a);
      const bVal = getValue(b);

      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return {
      rows: sorted.slice(start, end),
      totalPages,
    };
  }, [leads, search, statusFilter, sortKey, sortDirection, page]);

  function handleSort(nextKey: SortKey) {
    setPage(1);
    setSortKey((currentKey) => {
      if (currentKey !== nextKey) {
        setSortDirection(nextKey === "ai_score" ? "desc" : "asc");
        return nextKey;
      }

      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return currentKey;
    });
  }

  function goToPreviousPage() {
    setPage((prev) => Math.max(1, prev - 1));
  }

  function goToNextPage() {
    setPage((prev) => prev + 1);
  }

  return (
    <CSVUploader>
      {({ openPicker, importing }) => (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-lg backdrop-blur transition duration-200 ease-out hover:scale-[1.01]">
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
        <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">All leads</h2>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={importing}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              importing
                ? "cursor-default border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400"
                : "border border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-green-600 hover:text-white"
            }`}
          >
            {importing ? "Importing..." : "Import Leads"}
          </button>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`min-w-[220px] max-w-md ${inputFieldClassAuto}`}
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

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              style={{ ...titleCaseHeaderCellStyle, width: "44px", textAlign: "center" }}
              className="text-slate-600 dark:text-slate-400"
              aria-label="Favorite"
            />
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("name")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Name
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("email")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Email
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("phone")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Phone
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("budget")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Budget
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("timeline")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Timeline
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("ai_score")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Score
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">Breakdown</th>
            <th style={titleCaseHeaderCellStyle} className="text-slate-600 dark:text-slate-400">
              <button type="button" onClick={() => handleSort("created_at")} style={headerButtonStyle} className="text-slate-600 dark:text-slate-400">
                Created
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr
              key={lead.id}
              className="transition-colors duration-200 ease-out text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800"
              style={rowStyle}
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <td
                style={{ ...cellStyle, textAlign: "center", verticalAlign: "middle" }}
                onClick={(e) => e.stopPropagation()}
              >
                <LeadFavoriteStar
                  favorite={isFavorite(lead)}
                  onClick={(e) => handleToggleFavorite(lead, e)}
                />
              </td>
              <td style={cellStyle}>{lead.name ?? "—"}</td>
              <td style={cellStyle}>{lead.email ?? "—"}</td>
              <td style={cellStyle}>{lead.phone ?? "—"}</td>
              <td style={cellStyle}>{displayBudgetText(lead.budget)}</td>
              <td style={cellStyle}>{getDisplayTimeline(lead)}</td>
              <td style={cellStyle}>
                <LeadScoreBadge
                  aiScore={typeof lead.ai_score === "number" ? lead.ai_score : null}
                  confidenceScore={
                    typeof lead.ai_confidence === "number" ? lead.ai_confidence * 10 : undefined
                  }
                />
              </td>
              <td style={cellStyle}>
                <LeadScoreDetails
                  aiScoreBreakdown={lead.ai_score_breakdown ?? null}
                  aiSummary={lead.ai_summary ?? null}
                  compact
                />
              </td>
              <td style={cellStyle}>
                {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ ...cellStyle, textAlign: "center", padding: "24px" }} className="text-slate-500 dark:text-slate-400">
                No leads found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        className="text-slate-500 dark:text-slate-400"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          fontSize: "13px",
        }}
      >
        <span>
          Page {page} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={page <= 1}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523] ${
              page <= 1
                ? "cursor-default border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400"
                : "cursor-pointer border border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-green-600 hover:text-white"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={page >= totalPages}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523] ${
              page >= totalPages
                ? "cursor-default border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400"
                : "cursor-pointer border border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-green-600 hover:text-white"
            }`}
          >
            Next
          </button>
        </div>
      </div>
        </div>
      )}
    </CSVUploader>
  );
}

const headerCellStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "12px",
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
};

const titleCaseHeaderCellStyle: React.CSSProperties = {
  ...headerCellStyle,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: "14px",
};

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "12px",
  textAlign: "left",
  fontSize: "14px",
};

const rowStyle: React.CSSProperties = {
  cursor: "pointer",
  transition: "background-color 0.12s ease",
} as React.CSSProperties;

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
