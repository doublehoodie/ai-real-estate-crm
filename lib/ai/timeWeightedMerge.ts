import type { PerEmailStructuredExtractionResult } from "@/lib/ai/perEmailStructuredExtraction";
import type { PerEmailSignalRow } from "@/lib/ai/structuredLeadExtraction";
import type { StructuredLeadContradiction, StructuredLeadExtraction } from "@/lib/ai/structuredLeadExtraction";

const DOWNGRADE_RE =
  /just\s+browsing|browsing\s+only|not\s+ready|exploring\s+options|maybe\s+later|hold\s+off|step(?:ping)?\s+back|not\s+interested|cooling\s+off|paused\s+our\s+search/i;

function levelToScore(level: "high" | "medium" | "low"): number {
  if (level === "high") return 1;
  if (level === "medium") return 0.55;
  return 0.15;
}

function scoreToLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.72) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

/**
 * Latest = 0.6, second = 0.25, remaining emails share 0.15. Normalized to sum to 1.
 */
function buildWeights(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  if (n === 2) {
    const a = 0.6;
    const b = 0.25;
    const s = a + b;
    return [a / s, b / s];
  }
  const w: number[] = [];
  w[0] = 0.6;
  w[1] = 0.25;
  const rest = n - 2;
  const each = rest > 0 ? 0.15 / rest : 0;
  for (let i = 2; i < n; i++) w[i] = each;
  const sum = w.reduce((x, y) => x + y, 0);
  return w.map((x) => x / sum);
}

/**
 * Sort newest first for weighting and latest-text checks.
 */
export function sortEmailsNewestFirst(rows: PerEmailSignalRow[]): PerEmailSignalRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  );
}

export function latestEmailTextHint(emails: { received_at: string; text: string }[]): string {
  const sorted = [...emails].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
  );
  return sorted[0]?.text?.trim() ?? "";
}

export function mergePerEmailIntoStructuredLeadExtraction(
  raw: PerEmailStructuredExtractionResult,
  emailBodiesOrdered: { received_at: string; text: string }[],
): StructuredLeadExtraction {
  const sortedSignals = sortEmailsNewestFirst(raw.per_email);
  const latestText = latestEmailTextHint(emailBodiesOrdered);
  const downgradeRegex = DOWNGRADE_RE.test(latestText);
  const downgrade = raw.latest_indicates_downgrade || downgradeRegex;

  let intent_level: "high" | "medium" | "low";
  let urgency: "high" | "medium" | "low";
  let timeline: string | null;

  if (sortedSignals.length === 0) {
    intent_level = "medium";
    urgency = "medium";
    timeline = null;
  } else if (downgrade) {
    intent_level = sortedSignals[0].intent_level;
    urgency = sortedSignals[0].urgency;
    timeline = sortedSignals[0].timeline;
  } else {
    const weights = buildWeights(sortedSignals.length);
    let intentScore = 0;
    let urgencyScore = 0;
    for (let i = 0; i < sortedSignals.length; i++) {
      intentScore += levelToScore(sortedSignals[i].intent_level) * weights[i];
      urgencyScore += levelToScore(sortedSignals[i].urgency) * weights[i];
    }
    intent_level = scoreToLevel(intentScore);
    urgency = scoreToLevel(urgencyScore);
    timeline = sortedSignals[0].timeline ?? null;
  }

  const budget =
    sortedSignals[0]?.budget ??
    sortedSignals.find((r) => r.budget != null)?.budget ??
    raw.budget ??
    null;

  const contradictions: StructuredLeadContradiction[] = [...raw.notes_factual_contradictions];

  let intent_temporal_shift = raw.intent_temporal_shift?.trim() || null;
  if (!intent_temporal_shift && sortedSignals.length >= 2) {
    const oldest = [...sortedSignals].sort(
      (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
    )[0];
    const latest = sortedSignals[0];
    if (oldest && latest && oldest !== latest) {
      const wasHigh = oldest.intent_level === "high";
      const nowLow = latest.intent_level === "low";
      if (wasHigh && nowLow) {
        intent_temporal_shift = "Intent has shifted from high to low over time";
      } else if (oldest.intent_level !== latest.intent_level) {
        intent_temporal_shift = `Intent has shifted from ${oldest.intent_level} to ${latest.intent_level} over time`;
      }
    }
  }

  return {
    budget,
    timeline,
    intent_level,
    urgency,
    phone: null,
    key_needs: sortedSignals[0]?.key_phrases ?? [],
    summary: raw.summary,
    contradictions,
    confidence_score: raw.confidence_score,
    confidence_reasoning: raw.confidence_reasoning,
    per_email_signals: raw.per_email,
    intent_temporal_shift,
  };
}
