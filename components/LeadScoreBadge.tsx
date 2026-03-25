import { getConfidenceLabel, getScoreBand } from "@/lib/scoring";

type LeadScoreBadgeProps = {
  score: number | null;
  confidenceScore?: number | null;
};

export function LeadScoreBadge({ score, confidenceScore }: LeadScoreBadgeProps) {
  const band = getScoreBand(score);
  const confidence = getConfidenceLabel(confidenceScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 10px",
          borderRadius: "999px",
          background: getBandBackground(band.label),
          color: getBandColor(band.label),
          fontWeight: 700,
          fontSize: "13px",
          lineHeight: 1,
        }}
      >
        <span>{score ?? "—"}</span>
        <span style={{ opacity: 0.8 }}>{band.label}</span>
      </span>

      <span style={{ fontSize: "12px", color: "#6b7280", textTransform: "capitalize" }}>
        Confidence: {confidence}
      </span>
    </div>
  );
}

function getBandBackground(label: string) {
  if (label === "Hot") {
    return "var(--danger-soft)";
  }

  if (label === "Warm") {
    return "var(--warning-soft)";
  }

  return "#e5eefb";
}

function getBandColor(label: string) {
  if (label === "Hot") {
    return "var(--danger-text)";
  }

  if (label === "Warm") {
    return "var(--warning-text)";
  }

  return "#1d4ed8";
}
