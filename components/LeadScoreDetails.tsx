"use client";

import type { LeadScoreBreakdown } from "@/types/lead";

type LeadScoreDetailsProps = {
  breakdown: LeadScoreBreakdown | null;
  explanation: string[] | null;
  compact?: boolean;
};

export function LeadScoreDetails({
  breakdown,
  explanation,
  compact = false,
}: LeadScoreDetailsProps) {
  if (!breakdown || !explanation || explanation.length === 0) {
    return <span style={{ color: "#6b7280", fontSize: "13px" }}>Score details unavailable.</span>;
  }

  return (
    <details onClick={(event) => event.stopPropagation()}>
      <summary
        onClick={(event) => event.stopPropagation()}
        style={{ cursor: "pointer", color: "#1bbff6", fontSize: "13px", fontWeight: 600 }}
      >
        Why this score
      </summary>

      <div style={{ marginTop: "10px", display: "grid", gap: compact ? "8px" : "12px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "8px",
          }}
        >
          <ScoreBreakdownItem label="Financial" value={`${breakdown.financialReadiness}/30`} />
          <ScoreBreakdownItem label="Urgency" value={`${breakdown.urgency}/25`} />
          <ScoreBreakdownItem label="Intent" value={`${breakdown.behavioralIntent}/20`} />
          <ScoreBreakdownItem label="Fit" value={`${breakdown.fitReadiness}/15`} />
          <ScoreBreakdownItem label="Confidence" value={`${breakdown.dataConfidence}/10`} />
        </div>

        <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px", lineHeight: 1.5 }}>
          {(compact ? [] : explanation).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ScoreBreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "10px 12px",
        background: "#f8fafc",
      }}
    >
      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}
