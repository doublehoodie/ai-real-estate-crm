import { SCORING_RUBRIC } from "@/lib/scoring";
import type { StructuredLeadExtraction } from "@/lib/ai/structuredLeadExtraction";

export type DeterministicAiScore = {
  score: number;
  breakdown: {
    budget: number;
    timeline: number;
    intent: number;
    urgency: number;
  };
  has_contradictions: boolean;
};

export function computeDeterministicAiScore(extraction: StructuredLeadExtraction): DeterministicAiScore {
  const noSignalInputs =
    extraction.budget == null &&
    extraction.timeline == null &&
    extraction.intent_level === "low" &&
    extraction.urgency === "low";

  const budgetMax = rubricMax("financialReadiness");
  const timelineMax = rubricMax("urgency");
  const intentMax = rubricMax("behavioralIntent");
  const urgencyMax = rubricMax("fitReadiness");

  const budgetPoints = noSignalInputs ? 0 : extraction.budget == null ? 0 : budgetMax;
  const timelinePoints = noSignalInputs
    ? 0
    : extraction.timeline == null
      ? 0
      : scoreTimeline(extraction.timeline, timelineMax);
  const intentPoints = noSignalInputs ? 0 : scoreLevel(extraction.intent_level, intentMax);
  const urgencyPoints = noSignalInputs ? 0 : scoreLevel(extraction.urgency, urgencyMax);
  const hasContradictions = extraction.contradictions.length > 0;
  const breakdown = {
    budget: budgetPoints,
    timeline: timelinePoints,
    intent: intentPoints,
    urgency: urgencyPoints,
  };

  const score = clamp(
    Math.round(breakdown.budget + breakdown.timeline + breakdown.intent + breakdown.urgency),
    0,
    100,
  );

  return {
    score,
    breakdown,
    has_contradictions: hasContradictions,
  };
}

function scoreTimeline(value: string, max: number): number {
  const t = value.toLowerCase();
  if (
    t.includes("now") ||
    t.includes("asap") ||
    t.includes("immediate") ||
    t.includes("urgent") ||
    t.includes("week") ||
    t.includes("month")
  ) {
    return max;
  }
  if (t.includes("quarter") || t.includes("3") || t.includes("6")) {
    return Math.round(max * 0.6);
  }
  return Math.round(max * 0.4);
}

function scoreLevel(level: "high" | "medium" | "low", max: number): number {
  if (level === "high") return max;
  if (level === "medium") return Math.round(max * 0.6);
  return 0;
}

function rubricMax(
  key: "financialReadiness" | "urgency" | "behavioralIntent" | "fitReadiness",
): number {
  return SCORING_RUBRIC.find((r) => r.key === key)?.maxScore ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
