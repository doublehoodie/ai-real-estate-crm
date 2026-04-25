import { getConfidenceLabel } from "@/lib/scoring";
import { scoreColorsFromAiScore } from "@/lib/ui/scoreColors";

type LeadScoreBadgeProps = {
  aiScore: number | null;
  confidenceScore?: number | null;
  /** When false, hides the confidence line (e.g. when confidence is shown in its own column). */
  showConfidenceLine?: boolean;
};

export function LeadScoreBadge({ aiScore, confidenceScore, showConfidenceLine = true }: LeadScoreBadgeProps) {
  const colors = scoreColorsFromAiScore(aiScore);
  const confidence = getConfidenceLabel(confidenceScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-2 text-[13px] font-bold leading-none ${colors.pillClass}`}
      >
        <span>{aiScore ?? "—"}</span>
        <span style={{ opacity: 0.8 }}>{colors.label}</span>
      </span>

      {showConfidenceLine ? (
        <span className="text-[12px] capitalize text-slate-500 dark:text-slate-400">
          Confidence: {confidence}
        </span>
      ) : null}
    </div>
  );
}
