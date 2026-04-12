"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/types/lead";
import { displayBudgetText } from "@/lib/format";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import { LeadScoreDetails } from "@/components/LeadScoreDetails";
import { LeadFavoriteStar } from "@/components/LeadFavoriteStar";

type LeadTableFullProps = {
  leads: Lead[] | null;
};

type SortKey = "name" | "email" | "phone" | "budget" | "timeline" | "score" | "status" | "notes" | "created_at";

export function LeadTableFull({ leads }: LeadTableFullProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Hot" | "Warm" | "Cold">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
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

    const { error } = await supabase.from("leads").update({ is_favorite: next }).eq("id", lead.id);

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
      const matchesStatus =
        statusFilter === "all" || (lead.status && lead.status.toLowerCase() === statusFilter.toLowerCase());

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
          case "notes":
            return (lead[sortKey] ?? "").toString().toLowerCase();
          case "score":
            return lead.score ?? -Infinity;
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
        setSortDirection(nextKey === "score" ? "desc" : "asc");
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
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        overflowX: "auto",
      }}
    >
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
        <h2 style={{ margin: 0, color: "#111" }}>All leads</h2>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              minWidth: "220px",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              backgroundColor: "white",
            }}
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
            <th
              style={{ ...titleCaseHeaderCellStyle, width: "44px", textAlign: "center" }}
              aria-label="Favorite"
            />
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("name")} style={headerButtonStyle}>
                Name
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("email")} style={headerButtonStyle}>
                Email
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("phone")} style={headerButtonStyle}>
                Phone
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("budget")} style={headerButtonStyle}>
                Budget
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("timeline")} style={headerButtonStyle}>
                Timeline
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("score")} style={headerButtonStyle}>
                Score
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>Breakdown</th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("notes")} style={headerButtonStyle}>
                Notes
              </button>
            </th>
            <th style={titleCaseHeaderCellStyle}>
              <button type="button" onClick={() => handleSort("created_at")} style={headerButtonStyle}>
                Created
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr
              key={lead.id}
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
              <td style={cellStyle}>{lead.timeline ?? "—"}</td>
              <td style={cellStyle}>
                <LeadScoreBadge
                  score={lead.score}
                  confidenceScore={lead.score_breakdown?.dataConfidence}
                />
              </td>
              <td style={cellStyle}>
                <LeadScoreDetails
                  breakdown={lead.score_breakdown}
                  explanation={lead.score_explanation}
                  compact
                />
              </td>
              <td style={cellStyle}>{getNotesPreview(lead.notes)}</td>
              <td style={cellStyle}>
                {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={10} style={{ ...cellStyle, textAlign: "center", color: "#6b7280", padding: "24px" }}>
                No leads found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          fontSize: "13px",
          color: "#6b7280",
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
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              background: page <= 1 ? "#f9fafb" : "white",
              color: page <= 1 ? "#9ca3af" : "#111827",
              cursor: page <= 1 ? "default" : "pointer",
              fontSize: "13px",
            }}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={page >= totalPages}
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              background: page >= totalPages ? "#f9fafb" : "white",
              color: page >= totalPages ? "#9ca3af" : "#111827",
              cursor: page >= totalPages ? "default" : "pointer",
              fontSize: "13px",
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "12px",
  textAlign: "left",
  color: "#6b7280",
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
  color: "#111827",
  cursor: "pointer",
};

const titleCaseHeaderCellStyle: React.CSSProperties = {
  ...headerCellStyle,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: "14px",
  color: "#111827",
};

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "12px",
  textAlign: "left",
  color: "#222",
  fontSize: "14px",
};

const rowStyle: React.CSSProperties = {
  cursor: "pointer",
  transition: "background-color 0.12s ease",
} as React.CSSProperties;

function getNotesPreview(notes: string | null) {
  if (!notes) {
    return "—";
  }

  return notes.length > 88 ? `${notes.slice(0, 88).trim()}...` : notes;
}
