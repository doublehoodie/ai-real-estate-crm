import type { Lead, LeadScoreBreakdown, LeadScoreConfidence } from "@/types/lead";

type ScoringCategoryKey =
  | "financialReadiness"
  | "urgency"
  | "behavioralIntent"
  | "fitReadiness"
  | "dataConfidence";

type ScoreCategoryRule = {
  label: string;
  points: number;
  criteria: string;
};

type CategoryScore = {
  points: number;
  reason: string;
};

export type NoteSignals = {
  matchedKeywords: string[];
  financialSignal: "verified_funds" | "strong_signal" | null;
  urgencySignal: "immediate" | "under_3_months" | "three_to_six_months" | "six_to_twelve_months" | "browsing" | null;
  intentSignal: "requested_showing" | "property_questions" | "engaged" | "general_inquiry" | "browsing" | null;
  hasLocation: boolean;
  propertyType: string | null;
  hasConstraints: boolean;
  vagueLanguage: boolean;
  strongSignalCount: number;
};

export type ScoreLeadResult = {
  score: number;
  breakdown: LeadScoreBreakdown;
  explanation: string[];
  confidence: LeadScoreConfidence;
};

export const SCORE_INTERPRETATION = [
  {
    label: "Hot",
    minScore: 70,
    description: "High-priority lead with strong financial and behavioral signals.",
  },
  {
    label: "Warm",
    minScore: 40,
    description: "Promising lead that needs follow-up or more qualification.",
  },
  {
    label: "Cold",
    minScore: 0,
    description: "Early-stage or low-signal lead that belongs in nurture.",
  },
] as const;

export const SCORING_RUBRIC: Array<{
  key: ScoringCategoryKey;
  label: string;
  maxScore: number;
  rules: ScoreCategoryRule[];
}> = [
  {
    key: "financialReadiness",
    label: "Financial Readiness",
    maxScore: 30,
    rules: [
      { label: "Verified funds", points: 30, criteria: "Pre-approved or proof of funds confirmed." },
      { label: "Strong signal", points: 20, criteria: "Notes mention strong readiness such as cash buyer." },
      { label: "Budget clearly specified", points: 10, criteria: "Budget is concrete or numerically stated." },
      { label: "Budget vague", points: 5, criteria: "Budget direction exists but is not precise." },
      { label: "None", points: 0, criteria: "No meaningful financial signal present." },
    ],
  },
  {
    key: "urgency",
    label: "Urgency / Timeline",
    maxScore: 25,
    rules: [
      { label: "Immediate / ASAP", points: 25, criteria: "Ready now, ASAP, or immediate move intent." },
      { label: "Within 3 months", points: 20, criteria: "Timeline is three months or less." },
      { label: "3–6 months", points: 12, criteria: "Timeline falls between three and six months." },
      { label: "6–12 months", points: 5, criteria: "Timeline falls between six and twelve months." },
      { label: "Browsing / over 12 months", points: 0, criteria: "More than a year out or only browsing." },
    ],
  },
  {
    key: "behavioralIntent",
    label: "Behavioral Intent",
    maxScore: 20,
    rules: [
      { label: "Requested showing", points: 20, criteria: "Asked to tour, visit, or schedule a showing." },
      { label: "Specific property questions", points: 15, criteria: "Asked concrete listing or property questions." },
      { label: "Engaged / responsive", points: 10, criteria: "Responsive, returned messages, or otherwise engaged." },
      { label: "General inquiry", points: 5, criteria: "Basic inquiry without strong buying behavior." },
      { label: "Browsing", points: 0, criteria: "Window-shopping language with little commitment." },
    ],
  },
  {
    key: "fitReadiness",
    label: "Fit Readiness",
    maxScore: 15,
    rules: [
      { label: "Location specified", points: 5, criteria: "Specific market, neighborhood, or area is named." },
      { label: "Budget range specified", points: 3, criteria: "Budget range or numeric budget is present." },
      { label: "Property type specified", points: 3, criteria: "Condo, townhouse, single-family, etc. is mentioned." },
      { label: "Constraints noted", points: 4, criteria: "Beds, commute, schools, garage, or other constraints are listed." },
      { label: "Vague language penalty", points: -5, criteria: "Language is too broad, flexible, or unclear." },
    ],
  },
  {
    key: "dataConfidence",
    label: "Data Confidence",
    maxScore: 10,
    rules: [
      { label: "Verified data", points: 10, criteria: "Rich record with strong contact and qualification signals." },
      { label: "Multiple strong signals", points: 7, criteria: "Several strong fields or note signals support scoring." },
      { label: "Moderate", points: 5, criteria: "Enough detail for a reasonable score, but still partial." },
      { label: "Sparse", points: 2, criteria: "Only limited structure or note detail is available." },
      { label: "Minimal", points: 0, criteria: "Very little information available." },
    ],
  },
];

type ScoreableLead = Partial<
  Pick<
    Lead,
  "name" | "email" | "phone" | "budget" | "timeline" | "notes" | "score" | "score_breakdown" | "score_explanation"
  >
>;

const VERIFIED_FUNDS_KEYWORDS = [
  "pre-approved",
  "pre approved",
  "preapproved",
  "proof of funds",
  "pof",
];

const STRONG_FINANCIAL_KEYWORDS = [
  "cash buyer",
  "all cash",
  "cash offer",
  "cash purchase",
];

const IMMEDIATE_KEYWORDS = ["asap", "immediately", "immediate", "right away", "this month", "urgent"];
const BROWSING_KEYWORDS = ["just browsing", "browsing", "window shopping", "curious", "exploring options"];
const SHOWING_KEYWORDS = ["showing", "tour", "walkthrough", "see the property", "visit the property", "schedule a visit"];
const PROPERTY_QUESTION_KEYWORDS = ["hoa", "taxes", "school district", "seller disclosure", "square footage", "inspection", "listing"];
const ENGAGED_KEYWORDS = ["responsive", "replied", "followed up", "called back", "engaged", "active conversation"];
const GENERAL_INQUIRY_KEYWORDS = ["interested", "looking for", "inquiry", "wants info", "asking about"];
const PROPERTY_TYPES = ["condo", "townhome", "townhouse", "single-family", "single family", "duplex", "multi-family", "multifamily", "land"];
const CONSTRAINT_KEYWORDS = [
  "bed",
  "bath",
  "commute",
  "school",
  "garage",
  "yard",
  "office",
  "pool",
  "pet",
  "walkable",
];
const VAGUE_KEYWORDS = ["flexible", "open to anything", "not sure", "tbd", "whatever works", "no rush"];

export function extractSignalsFromNotes(notes: string | null | undefined): NoteSignals {
  const raw = notes ?? "";
  const normalized = normalizeText(raw);
  const matchedKeywords = new Set<string>();

  const hasVerifiedFunds = matchesAny(normalized, VERIFIED_FUNDS_KEYWORDS, matchedKeywords);
  const hasStrongFinancial = matchesAny(normalized, STRONG_FINANCIAL_KEYWORDS, matchedKeywords);
  const isImmediate = matchesAny(normalized, IMMEDIATE_KEYWORDS, matchedKeywords);
  const isBrowsing = matchesAny(normalized, BROWSING_KEYWORDS, matchedKeywords);
  const requestedShowing = matchesAny(normalized, SHOWING_KEYWORDS, matchedKeywords);
  const askedPropertyQuestions = matchesAny(normalized, PROPERTY_QUESTION_KEYWORDS, matchedKeywords);
  const engaged = matchesAny(normalized, ENGAGED_KEYWORDS, matchedKeywords);
  const generalInquiry = matchesAny(normalized, GENERAL_INQUIRY_KEYWORDS, matchedKeywords);
  const vagueLanguage = matchesAny(normalized, VAGUE_KEYWORDS, matchedKeywords);
  const propertyType = PROPERTY_TYPES.find((type) => normalized.includes(type)) ?? null;
  if (propertyType) {
    matchedKeywords.add(propertyType);
  }

  const hasConstraints = CONSTRAINT_KEYWORDS.some((keyword) => {
    const hit = normalized.includes(keyword);
    if (hit) {
      matchedKeywords.add(keyword);
    }
    return hit;
  });

  const hasLocation =
    /\b(in|near|around|moving to|relocating to|looking in|prefer|prefers)\s+[a-z0-9][a-z0-9\s-]{2,}\b/.test(normalized) ||
    /\b(downtown|midtown|uptown|suburbs|waterfront|school district)\b/.test(normalized);
  if (hasLocation) {
    matchedKeywords.add("location");
  }

  let urgencySignal: NoteSignals["urgencySignal"] = null;
  if (isImmediate) {
    urgencySignal = "immediate";
  } else if (/\b(1|2|3)\s*(month|months|mo)\b/.test(normalized) || /\b(30|60|90)\s*days?\b/.test(normalized)) {
    urgencySignal = "under_3_months";
  } else if (/\b(4|5|6)\s*(month|months|mo)\b/.test(normalized)) {
    urgencySignal = "three_to_six_months";
  } else if (/\b(7|8|9|10|11|12)\s*(month|months|mo)\b/.test(normalized) || /\bwithin a year\b/.test(normalized)) {
    urgencySignal = "six_to_twelve_months";
  } else if (isBrowsing) {
    urgencySignal = "browsing";
  }

  let intentSignal: NoteSignals["intentSignal"] = null;
  if (requestedShowing) {
    intentSignal = "requested_showing";
  } else if (askedPropertyQuestions) {
    intentSignal = "property_questions";
  } else if (engaged) {
    intentSignal = "engaged";
  } else if (generalInquiry) {
    intentSignal = "general_inquiry";
  } else if (isBrowsing) {
    intentSignal = "browsing";
  }

  const strongSignalCount = [
    hasVerifiedFunds,
    hasStrongFinancial,
    isImmediate,
    requestedShowing,
    askedPropertyQuestions,
    hasLocation,
    Boolean(propertyType),
    hasConstraints,
  ].filter(Boolean).length;

  return {
    matchedKeywords: Array.from(matchedKeywords),
    financialSignal: hasVerifiedFunds ? "verified_funds" : hasStrongFinancial ? "strong_signal" : null,
    urgencySignal,
    intentSignal,
    hasLocation,
    propertyType,
    hasConstraints,
    vagueLanguage,
    strongSignalCount,
  };
}

export function scoreFinancial(lead: ScoreableLead): CategoryScore {
  const notesSignals = extractSignalsFromNotes(lead.notes);
  const budget = normalizeText(lead.budget);

  if (notesSignals.financialSignal === "verified_funds") {
    return {
      points: 30,
      reason: "Verified funds signal detected from notes, such as pre-approval or proof of funds.",
    };
  }

  if (notesSignals.financialSignal === "strong_signal") {
    return {
      points: 20,
      reason: "Strong financial readiness detected from notes, such as a cash buyer signal.",
    };
  }

  if (hasClearBudget(lead.budget)) {
    return {
      points: 10,
      reason: "Budget is clearly specified.",
    };
  }

  if (budget && isVagueBudget(budget)) {
    return {
      points: 5,
      reason: "Budget direction exists, but it is still vague.",
    };
  }

  return {
    points: 0,
    reason: "No meaningful financial readiness signal is available yet.",
  };
}

export function scoreUrgency(lead: ScoreableLead): CategoryScore {
  const combined = normalizeText([lead.timeline, lead.notes].filter(Boolean).join(" "));
  const signals = extractSignalsFromNotes(lead.notes);

  if (signals.urgencySignal === "immediate" || matchesAny(combined, IMMEDIATE_KEYWORDS)) {
    return { points: 25, reason: "Lead appears ready to move immediately." };
  }

  if (signals.urgencySignal === "under_3_months" || /\b(1|2|3)\s*(month|months|mo)\b/.test(combined) || /\b(30|60|90)\s*days?\b/.test(combined)) {
    return { points: 20, reason: "Timeline indicates a move within three months." };
  }

  if (signals.urgencySignal === "three_to_six_months" || /\b(4|5|6)\s*(month|months|mo)\b/.test(combined) || /\b3[-– ]?6 months\b/.test(combined)) {
    return { points: 12, reason: "Timeline falls in the three-to-six month range." };
  }

  if (signals.urgencySignal === "six_to_twelve_months" || /\b(7|8|9|10|11|12)\s*(month|months|mo)\b/.test(combined) || /\b6[-– ]?12 months\b/.test(combined) || /\bwithin a year\b/.test(combined)) {
    return { points: 5, reason: "Timeline is still active, but farther out at six to twelve months." };
  }

  return { points: 0, reason: "Lead looks long-term or is still browsing." };
}

export function scoreIntent(lead: ScoreableLead): CategoryScore {
  const combined = normalizeText([lead.notes, lead.timeline].filter(Boolean).join(" "));
  const signals = extractSignalsFromNotes(lead.notes);

  if (signals.intentSignal === "requested_showing" || matchesAny(combined, SHOWING_KEYWORDS)) {
    return { points: 20, reason: "Lead requested a showing or property visit." };
  }

  if (signals.intentSignal === "property_questions" || matchesAny(combined, PROPERTY_QUESTION_KEYWORDS)) {
    return { points: 15, reason: "Lead asked specific property questions, which signals concrete interest." };
  }

  if (signals.intentSignal === "engaged" || matchesAny(combined, ENGAGED_KEYWORDS)) {
    return { points: 10, reason: "Lead is engaged and responsive." };
  }

  if (signals.intentSignal === "general_inquiry" || matchesAny(combined, GENERAL_INQUIRY_KEYWORDS)) {
    return { points: 5, reason: "Lead has shown general interest but limited behavioral intent." };
  }

  return { points: 0, reason: "Behavioral intent is weak or still in browsing mode." };
}

export function scoreFit(lead: ScoreableLead): CategoryScore {
  const signals = extractSignalsFromNotes(lead.notes);
  let points = 0;
  const reasons: string[] = [];

  if (signals.hasLocation) {
    points += 5;
    reasons.push("location specified");
  }

  if (hasClearBudget(lead.budget)) {
    points += 3;
    reasons.push("budget range specified");
  }

  if (signals.propertyType) {
    points += 3;
    reasons.push(`${signals.propertyType} specified`);
  }

  if (signals.hasConstraints) {
    points += 4;
    reasons.push("buyer constraints captured");
  }

  if (signals.vagueLanguage) {
    points -= 5;
    reasons.push("vague language penalty applied");
  }

  return {
    points: clamp(points, 0, 15),
    reason: reasons.length > 0 ? `Fit signals: ${reasons.join(", ")}.` : "Fit is still vague and under-specified.",
  };
}

export function scoreConfidence(lead: ScoreableLead): CategoryScore {
  const signals = extractSignalsFromNotes(lead.notes);
  const hasName = Boolean(lead.name?.trim());
  const hasEmail = Boolean(lead.email?.trim());
  const hasPhone = Boolean(lead.phone?.trim());
  const hasBudget = Boolean(lead.budget?.trim());
  const hasTimeline = Boolean(lead.timeline?.trim());
  const noteLength = lead.notes?.trim().length ?? 0;
  const fieldCount = [hasName, hasEmail, hasPhone, hasBudget, hasTimeline, noteLength > 0].filter(Boolean).length;

  if ((hasEmail || hasPhone) && hasBudget && hasTimeline && noteLength >= 30 && signals.strongSignalCount >= 3) {
    return { points: 10, reason: "Record has verified contact details plus enough structure to score with high confidence." };
  }

  if (signals.strongSignalCount >= 3 || (hasBudget && hasTimeline && noteLength >= 20)) {
    return { points: 7, reason: "Multiple strong signals support this score." };
  }

  if (fieldCount >= 4) {
    return { points: 5, reason: "Moderate data coverage supports a reasonable score." };
  }

  if (fieldCount >= 2) {
    return { points: 2, reason: "Only sparse information is available." };
  }

  return { points: 0, reason: "Data is too minimal to score with confidence." };
}

export function scoreLead(lead: ScoreableLead): ScoreLeadResult {
  const financialReadiness = scoreFinancial(lead);
  const urgency = scoreUrgency(lead);
  const behavioralIntent = scoreIntent(lead);
  const fitReadiness = scoreFit(lead);
  const dataConfidence = scoreConfidence(lead);

  const breakdown: LeadScoreBreakdown = {
    financialReadiness: financialReadiness.points,
    urgency: urgency.points,
    behavioralIntent: behavioralIntent.points,
    fitReadiness: fitReadiness.points,
    dataConfidence: dataConfidence.points,
  };

  const score = clamp(
    breakdown.financialReadiness +
      breakdown.urgency +
      breakdown.behavioralIntent +
      breakdown.fitReadiness +
      breakdown.dataConfidence,
    0,
    100,
  );

  return {
    score,
    breakdown,
    explanation: [
      `Financial readiness: ${financialReadiness.points}/30. ${financialReadiness.reason}`,
      `Urgency: ${urgency.points}/25. ${urgency.reason}`,
      `Behavioral intent: ${behavioralIntent.points}/20. ${behavioralIntent.reason}`,
      `Fit readiness: ${fitReadiness.points}/15. ${fitReadiness.reason}`,
      `Data confidence: ${dataConfidence.points}/10. ${dataConfidence.reason}`,
    ],
    confidence: getConfidenceLabel(breakdown.dataConfidence),
  };
}

export function resolveLeadScoring(lead: Lead): Lead {
  if (lead.score !== null && lead.score_breakdown && lead.score_explanation) {
    return lead;
  }

  const computed = scoreLead(lead);

  return {
    ...lead,
    score: computed.score,
    score_breakdown: computed.breakdown,
    score_explanation: computed.explanation,
  };
}

export function buildScoredLeadPayload(
  lead: ScoreableLead & { status?: string | null; is_favorite?: boolean },
) {
  const computed = scoreLead(lead as ScoreableLead);

  return {
    ...lead,
    score: computed.score,
    score_breakdown: computed.breakdown,
    score_explanation: computed.explanation,
    updated_at: new Date().toISOString(),
  };
}

export function stripScoringPersistenceFields<T extends Record<string, unknown>>(payload: T) {
  const rest = { ...payload };
  delete rest.score_breakdown;
  delete rest.score_explanation;
  delete rest.updated_at;

  return rest as Omit<T, "score_breakdown" | "score_explanation" | "updated_at">;
}

export function isMissingColumnError(message: string | undefined, columnName: string) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes(columnName.toLowerCase()) && normalized.includes("column");
}

export function getConfidenceLabel(dataConfidenceScore: number | null | undefined): LeadScoreConfidence {
  if ((dataConfidenceScore ?? 0) >= 8) {
    return "high";
  }

  if ((dataConfidenceScore ?? 0) >= 5) {
    return "medium";
  }

  return "low";
}

export function getScoreBand(score: number | null | undefined) {
  const safeScore = score ?? 0;
  return SCORE_INTERPRETATION.find((band) => safeScore >= band.minScore) ?? SCORE_INTERPRETATION[SCORE_INTERPRETATION.length - 1];
}

function hasClearBudget(budget: string | null | undefined) {
  if (!budget) {
    return false;
  }

  const normalized = normalizeText(budget);
  return /\$?\d[\d,]*/.test(normalized) || /\b\d+\s*[-–]\s*\d+\b/.test(normalized);
}

function isVagueBudget(value: string) {
  return ["around", "roughly", "flexible", "open", "tbd", "not sure"].some((keyword) => value.includes(keyword));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesAny(value: string, keywords: string[], collector?: Set<string>) {
  return keywords.some((keyword) => {
    const hit = value.includes(keyword);
    if (hit && collector) {
      collector.add(keyword);
    }
    return hit;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
