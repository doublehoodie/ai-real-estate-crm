"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/types/lead";
import { formatBudget } from "@/lib/format";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import { LeadScoreDetails } from "@/components/LeadScoreDetails";

type LeadTableProps = {
  leads: Lead[] | null;
};

export function LeadTable({ leads }: LeadTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Hot" | "Warm" | "Cold">("all");

  const rows = useMemo(() => {
    const allLeads = leads ?? [];

    return allLeads.filter((lead) => {
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
  }, [leads, search, statusFilter]);

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
        <h2 style={{ margin: 0, color: "#111" }}>Leads</h2>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              minWidth: "180px",
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
            <th style={headerCellStyle}>Name</th>
            <th style={headerCellStyle}>Budget</th>
            <th style={headerCellStyle}>Timeline</th>
            <th style={headerCellStyle}>Score</th>
            <th style={headerCellStyle}>Breakdown</th>
            <th style={headerCellStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr
              key={lead.id}
              style={rowStyle}
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <td style={cellStyle}>{lead.name ?? "—"}</td>
              <td style={cellStyle}>{formatBudget(lead.budget)}</td>
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
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: "#6b7280", padding: "24px" }}>
                No leads found. Adjust your filters or add a new lead.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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

  return notes.length > 72 ? `${notes.slice(0, 72).trim()}...` : notes;
}
