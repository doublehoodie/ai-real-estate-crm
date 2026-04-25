"use client";

type AiScoreBreakdown = {
  budget: number;
  timeline: number;
  intent: number;
  urgency: number;
};

type LeadScoreDetailsProps = {
  aiScoreBreakdown?: AiScoreBreakdown | null;
  /** Short context for AI-scored leads (e.g. ai_summary) */
  aiSummary?: string | null;
  compact?: boolean;
};

export function LeadScoreDetails({ aiScoreBreakdown, aiSummary, compact = false }: LeadScoreDetailsProps) {
  const hasAi = Boolean(
    aiScoreBreakdown &&
      typeof aiScoreBreakdown.budget === "number" &&
      typeof aiScoreBreakdown.timeline === "number" &&
      typeof aiScoreBreakdown.intent === "number" &&
      typeof aiScoreBreakdown.urgency === "number",
  );

  if (!hasAi || !aiScoreBreakdown) {
    return <span style={{ color: "#9ca3af", fontSize: "13px" }}>Score details unavailable.</span>;
  }

  const summaryLine = aiSummary?.trim();
  return (
    <details onClick={(event) => event.stopPropagation()}>
      <summary
        onClick={(event) => event.stopPropagation()}
        style={{ cursor: "pointer", color: "#4ade80", fontSize: "13px", fontWeight: 600 }}
      >
        Why this score
      </summary>

      <div style={{ marginTop: "10px", display: "grid", gap: compact ? "8px" : "12px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          <ScoreBreakdownItem label="Budget" value={`+${aiScoreBreakdown.budget}`} />
          <ScoreBreakdownItem label="Timeline" value={`+${aiScoreBreakdown.timeline}`} />
          <ScoreBreakdownItem label="Intent" value={`+${aiScoreBreakdown.intent}`} />
          <ScoreBreakdownItem label="Urgency" value={`+${aiScoreBreakdown.urgency}`} />
        </div>
        {!compact && summaryLine ? (
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "13px", lineHeight: 1.5 }}>{summaryLine}</p>
        ) : null}
      </div>
    </details>
  );
}

function ScoreBreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
        padding: "10px 12px",
        background: "rgba(38,38,38,0.7)",
      }}
    >
      <div style={{ fontSize: "12px", color: "#d1d5db", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#9ca3af" }}>{value}</div>
    </div>
  );
}
