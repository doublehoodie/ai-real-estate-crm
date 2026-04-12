import leadDictionary from "@/scoring/leadDictionary.js";
import { coercePhoneFromApi } from "@/lib/phone";
import type { Lead, LeadScoreBreakdown, LeadScoreConfidence } from "@/types/lead";

type ScoringCategoryKey =
  | "financialReadiness"
  | "urgency"
  | "behavioralIntent"
  | "fitReadiness"
  | "dataConfidence";

type DictionarySectionKey =
  | "financialReadiness"
  | "urgencyTimeline"
  | "behavioralIntent"
  | "fitReadiness"
  | "dataConfidence";

type DictionaryTierName = "strong" | "medium" | "weak" | "negative" | "sellerSignals";

type ScoreCategoryRule = {
  label: string;
  points: number;
  criteria: string;
};

type CategoryScore = {
  points: number;
  reason: string;
};

type DictionaryBucket = {
  weight?: number;
  keywords?: string[];
  phrases?: string[];
  regexPatterns?: RegExp[];
  notes?: string;
};

type DictionarySection = Partial<Record<DictionaryTierName, DictionaryBucket>> & {
  conflictSignals?: string[];
};

type DictionaryMatch = {
  sourceType: "keyword" | "phrase" | "regex";
  value: string;
};

type MatchedDictionarySignal = {
  section: DictionarySectionKey;
  tier: DictionaryTierName;
  source: "notes" | "timeline" | "budget";
  weight: number;
  note: string | undefined;
  matched: DictionaryMatch[];
};

type StructuredBudgetSignal = {
  hasBudget: boolean;
  isSpecific: boolean;
  isVague: boolean;
  reinforcedByNotes: boolean;
};

type StructuredTimelineSignal = {
  source: "timeline" | "notes" | "combined";
  primaryTier: DictionaryTierName | null;
  primarySignal: MatchedDictionarySignal | null;
  contradiction: boolean;
};

export type NoteSignals = {
  matchedTerms: string[];
  matchedSignals: Record<DictionarySectionKey, MatchedDictionarySignal[]>;
  contradictions: string[];
  ambiguousPhrases: string[];
  financialSignal: "verified_funds" | "strong_signal" | null;
  urgencySignal:
    | "immediate"
    | "under_3_months"
    | "three_to_six_months"
    | "six_to_twelve_months"
    | "browsing"
    | null;
  intentSignal:
    | "requested_showing"
    | "property_questions"
    | "engaged"
    | "general_inquiry"
    | "browsing"
    | null;
  hasLocation: boolean;
  propertyType: string | null;
  hasConstraints: boolean;
  vagueLanguage: boolean;
  strongSignalCount: number;
  budget: StructuredBudgetSignal;
  timeline: StructuredTimelineSignal;
};

export type ScoreLeadResult = {
  extractedSignals: NoteSignals;
  categoryScores: Record<ScoringCategoryKey, number>;
  confidenceScore: number;
  finalScore: number;
  label: string;
  score: number;
  breakdown: LeadScoreBreakdown;
  explanation: string[];
  confidence: LeadScoreConfidence;
};

const dictionary = leadDictionary as {
  financialReadiness: DictionarySection;
  urgencyTimeline: DictionarySection;
  behavioralIntent: DictionarySection;
  fitReadiness: DictionarySection;
  dataConfidence: DictionarySection;
  globalRegexLibrary: {
    budgetPatterns: RegExp[];
    timelinePatterns: RegExp[];
    bedBathPatterns: RegExp[];
    locationPatterns: RegExp[];
    contactValidationPatterns: RegExp[];
    agentShorthandPatterns: RegExp[];
  };
  ambiguousOrEdgeCasePhrases: {
    phrases: string[];
    notes: string;
  };
};

const DICTIONARY_SECTIONS: DictionarySectionKey[] = [
  "financialReadiness",
  "urgencyTimeline",
  "behavioralIntent",
  "fitReadiness",
  "dataConfidence",
];

const DICTIONARY_TIERS: DictionaryTierName[] = [
  "strong",
  "medium",
  "weak",
  "negative",
  "sellerSignals",
];

const PROPERTY_TYPE_HINTS = [
  "condo",
  "townhome",
  "townhouse",
  "single family",
  "single-family",
  "multi family",
  "multi-family",
  "duplex",
  "triplex",
  "co-op",
  "coop",
  "loft",
  "land",
];

const CONSTRAINT_HINTS = [
  "bed",
  "bath",
  "commute",
  "school",
  "parking",
  "garage",
  "yard",
  "office",
  "pool",
  "pet",
  "laundry",
  "doorman",
  "elevator",
  "path",
];

const LOCATION_HINTS = [
  "jersey city",
  "hoboken",
  "weehawken",
  "union city",
  "bayonne",
  "brooklyn",
  "queens",
  "manhattan",
  "downtown",
  "journal square",
  "hamilton park",
  "newport",
  "paulus hook",
  "path",
];

const VERIFIED_FINANCIAL_HINTS = [
  "pre-approved",
  "preapproved",
  "pre approval",
  "preapproval",
  "proof of funds",
  "pof",
  "fully approved",
  "underwritten",
  "underwriting",
  "approved for mortgage",
  "financing secured",
  "rate locked",
  "locked rate",
];

const STRONG_FINANCIAL_HINTS = [
  "cash buyer",
  "all cash",
  "cash deal",
  "down payment ready",
  "funds verified",
  "lender lined up",
  "working with lender",
];

const SHOWING_INTENT_HINTS = [
  "showing",
  "tour",
  "offer",
  "appointment",
  "countered",
  "next steps",
];

const PROPERTY_QUESTION_HINTS = [
  "hoa",
  "taxes",
  "disclosure",
  "comps",
  "fees",
  "floor plan",
  "inspection",
  "listing",
];

const ENGAGEMENT_HINTS = [
  "engaged",
  "responds fast",
  "quick to respond",
  "followed up",
  "called back",
  "returned call",
  "updates",
  "open house",
];

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
    | "name"
    | "email"
    | "phone"
    | "budget"
    | "budget_value"
    | "timeline"
    | "notes"
    | "score"
    | "score_breakdown"
    | "score_explanation"
  >
>;

export function extractSignalsFromNotes(
  notes: string | null | undefined,
  context?: { timeline?: string | null | undefined; budget?: string | null | undefined },
): NoteSignals {
  return extractLeadSignals({
    notes,
    timeline: context?.timeline,
    budget: context?.budget,
  });
}

export function scoreFinancial(lead: ScoreableLead): CategoryScore {
  const signals = extractLeadSignals(lead);
  const financialSignals = signals.matchedSignals.financialReadiness;

  if (signals.financialSignal === "verified_funds") {
    return {
      points: 30,
      reason: "Dictionary signals show verified financing readiness such as pre-approval or proof of funds.",
    };
  }

  if (signals.financialSignal === "strong_signal") {
    return {
      points: 20,
      reason: "Dictionary signals show strong financial readiness, such as cash-buyer or lender-readiness language.",
    };
  }

  if (signals.budget.isSpecific) {
    return {
      points: 10,
      reason: signals.budget.reinforcedByNotes
        ? "Budget is clearly specified and reinforced by notes."
        : "Budget is clearly specified.",
    };
  }

  if (signals.budget.hasBudget) {
    return {
      points: 5,
      reason: "Budget is present but still vague.",
    };
  }

  if (hasTier(financialSignals, "negative")) {
    return {
      points: 0,
      reason: "Financial notes contain negative qualification signals and no clear readiness evidence.",
    };
  }

  return {
    points: 0,
    reason: "No meaningful financial readiness signal is available yet.",
  };
}

export function scoreUrgency(lead: ScoreableLead): CategoryScore {
  const signals = extractLeadSignals(lead);
  const timelineSignals = signals.matchedSignals.urgencyTimeline;
  const primary = signals.timeline.primarySignal;

  if (signals.urgencySignal === "immediate") {
    return {
      points: 25,
      reason: primary?.source === "timeline"
        ? "Structured timeline indicates the lead is ready now or under active time pressure."
        : "Notes indicate the lead is ready now or under active time pressure.",
    };
  }

  if (signals.urgencySignal === "under_3_months") {
    return {
      points: 20,
      reason: "Timeline suggests a move within roughly three months.",
    };
  }

  if (signals.urgencySignal === "three_to_six_months") {
    return {
      points: 12,
      reason: "Timeline falls in the three-to-six month range.",
    };
  }

  if (signals.urgencySignal === "six_to_twelve_months") {
    return {
      points: 5,
      reason: "Timeline is active but farther out, around six to twelve months.",
    };
  }

  if (hasTier(timelineSignals, "negative")) {
    return {
      points: 0,
      reason: "Dictionary signals indicate the lead is browsing, delayed, or not moving soon.",
    };
  }

  return {
    points: 0,
    reason: "Urgency is unclear or too soft to materially raise priority.",
  };
}

export function scoreIntent(lead: ScoreableLead): CategoryScore {
  const signals = extractLeadSignals(lead);
  const intentSignals = signals.matchedSignals.behavioralIntent;

  if (signals.intentSignal === "requested_showing") {
    return {
      points: 20,
      reason: "Behavioral signals indicate a showing, tour, offer step, or another concrete action.",
    };
  }

  if (signals.intentSignal === "property_questions") {
    return {
      points: 15,
      reason: "Behavioral signals show specific listing or property questions.",
    };
  }

  if (signals.intentSignal === "engaged") {
    return {
      points: 10,
      reason: "Behavioral signals show the lead is engaged and responsive.",
    };
  }

  if (signals.intentSignal === "general_inquiry") {
    return {
      points: 5,
      reason: "Behavior is still top-of-funnel and general inquiry oriented.",
    };
  }

  if (hasTier(intentSignals, "negative")) {
    return {
      points: 0,
      reason: "Behavioral notes suggest the lead is disengaged, invalid, or not worth active follow-up.",
    };
  }

  return {
    points: 0,
    reason: "There is not enough behavioral evidence yet to raise intent score.",
  };
}

export function scoreFit(lead: ScoreableLead): CategoryScore {
  const signals = extractLeadSignals(lead);
  let points = 0;
  const reasons: string[] = [];

  if (signals.hasLocation) {
    points += 5;
    reasons.push("location specified");
  }

  if (signals.budget.isSpecific) {
    points += 3;
    reasons.push("budget range specified");
  }

  if (signals.propertyType) {
    points += 3;
    reasons.push(`${signals.propertyType} specified`);
  }

  if (signals.hasConstraints) {
    points += 4;
    reasons.push("constraints captured");
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
  const signals = extractLeadSignals(lead);
  const confidenceSignals = signals.matchedSignals.dataConfidence;
  const hasName = Boolean(lead.name?.trim());
  const hasEmail = Boolean(lead.email?.trim());
  const hasPhone = Boolean(String(lead.phone ?? "").trim());
  const hasBudget = Boolean(lead.budget?.trim());
  const hasTimeline = Boolean(lead.timeline?.trim());
  const notesLength = lead.notes?.trim().length ?? 0;
  const completenessCount = [hasName, hasEmail, hasPhone, hasBudget, hasTimeline, notesLength > 0].filter(Boolean).length;
  const contradictionPenalty = signals.contradictions.length;

  if (
    contradictionPenalty === 0 &&
    (hasEmail || hasPhone) &&
    hasBudget &&
    hasTimeline &&
    notesLength >= 30 &&
    (hasTier(confidenceSignals, "strong") || signals.strongSignalCount >= 3)
  ) {
    return {
      points: 10,
      reason: "The record is complete, internally consistent, and well-supported by notes and structured fields.",
    };
  }

  if (
    contradictionPenalty <= 1 &&
    (hasTier(confidenceSignals, "medium") || signals.strongSignalCount >= 2 || completenessCount >= 4)
  ) {
    return {
      points: 7,
      reason: contradictionPenalty === 1
        ? "The record has useful detail, but one contradiction reduces confidence."
        : "Multiple useful signals make this record reliable enough for confident prioritization.",
    };
  }

  if (contradictionPenalty <= 1 && completenessCount >= 3) {
    return {
      points: 5,
      reason: "The record is usable, but there are still enough gaps that confidence stays moderate.",
    };
  }

  if (completenessCount >= 2) {
    return {
      points: 2,
      reason: contradictionPenalty > 0
        ? "Sparse or conflicting details make this score tentative."
        : "Only a small amount of information is available.",
    };
  }

  return {
    points: 0,
    reason: "The record is too incomplete or contradictory to score with confidence.",
  };
}

export function scoreLead(lead: ScoreableLead & { createdAt?: string | null }): ScoreLeadResult {
  const extractedSignals = extractLeadSignals(lead);
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

  const finalScore = clamp(
    breakdown.financialReadiness +
      breakdown.urgency +
      breakdown.behavioralIntent +
      breakdown.fitReadiness +
      breakdown.dataConfidence,
    0,
    100,
  );

  const label = getScoreBand(finalScore).label;

  return {
    extractedSignals,
    categoryScores: { ...breakdown },
    confidenceScore: breakdown.dataConfidence,
    finalScore,
    label,
    score: finalScore,
    breakdown,
    explanation: buildExplanation({
      financialReadiness,
      urgency,
      behavioralIntent,
      fitReadiness,
      dataConfidence,
      contradictions: extractedSignals.contradictions,
    }),
    confidence: getConfidenceLabel(breakdown.dataConfidence),
  };
}

export function resolveLeadScoring(lead: Lead): Lead {
  const base: Lead = {
    ...lead,
    phone: coercePhoneFromApi(lead.phone),
  };

  if (base.score !== null && base.score_breakdown && base.score_explanation) {
    return base;
  }

  const computed = scoreLead(base);

  return {
    ...base,
    score: computed.score,
    score_breakdown: computed.breakdown,
    score_explanation: computed.explanation,
  };
}

export function buildScoredLeadPayload(
  lead: ScoreableLead & { status?: string | null; is_favorite?: boolean },
) {
  const computed = scoreLead(lead);

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
  return (
    SCORE_INTERPRETATION.find((band) => safeScore >= band.minScore) ??
    SCORE_INTERPRETATION[SCORE_INTERPRETATION.length - 1]
  );
}

function extractLeadSignals(
  lead: Pick<ScoreableLead, "notes" | "timeline" | "budget" | "name" | "email" | "phone">,
): NoteSignals {
  const notesText = normalizeText(lead.notes);
  const timelineText = normalizeText(lead.timeline);
  const budgetText = normalizeText(lead.budget);
  const combinedText = [notesText, timelineText, budgetText].filter(Boolean).join(" ");

  const matchedSignals: Record<DictionarySectionKey, MatchedDictionarySignal[]> = {
    financialReadiness: [
      ...matchDictionarySection("financialReadiness", notesText, "notes"),
      ...matchDictionarySection("financialReadiness", budgetText, "budget"),
    ],
    urgencyTimeline: [
      ...matchDictionarySection("urgencyTimeline", timelineText, "timeline"),
      ...matchDictionarySection("urgencyTimeline", notesText, "notes"),
    ],
    behavioralIntent: matchDictionarySection("behavioralIntent", notesText, "notes"),
    fitReadiness: matchDictionarySection("fitReadiness", notesText, "notes"),
    dataConfidence: matchDictionarySection("dataConfidence", combinedText, "notes"),
  };

  const ambiguousPhrases = dictionary.ambiguousOrEdgeCasePhrases.phrases.filter((phrase) =>
    notesText.includes(normalizeText(phrase)),
  );

  const contradictions = collectContradictions({
    combinedText,
    matchedSignals,
    timelineText,
    budgetText,
  });

  const budget = extractBudgetSignal(budgetText, matchedSignals.financialReadiness);
  const timeline = extractTimelineSignal(
    timelineText,
    notesText,
    matchedSignals.urgencyTimeline,
  );
  const fitSignals = matchedSignals.fitReadiness;
  const matchedTerms = flattenMatchedTerms(matchedSignals);

  return {
    matchedTerms,
    matchedSignals,
    contradictions,
    ambiguousPhrases,
    financialSignal: deriveFinancialSignal(matchedSignals.financialReadiness),
    urgencySignal: deriveUrgencySignal(timeline, matchedSignals.urgencyTimeline),
    intentSignal: deriveIntentSignal(matchedSignals.behavioralIntent),
    hasLocation: hasLocationSignal(fitSignals, notesText),
    propertyType: extractPropertyType(fitSignals),
    hasConstraints: hasConstraintSignal(fitSignals, notesText),
    vagueLanguage: hasVagueFitSignal(fitSignals),
    strongSignalCount: countStrongSignals(matchedSignals),
    budget,
    timeline,
  };
}

function matchDictionarySection(
  sectionKey: DictionarySectionKey,
  text: string,
  source: "notes" | "timeline" | "budget",
): MatchedDictionarySignal[] {
  if (!text) {
    return [];
  }

  const section = dictionary[sectionKey];
  const matches: MatchedDictionarySignal[] = [];

  for (const tier of DICTIONARY_TIERS) {
    const bucket = section[tier];
    if (!bucket) {
      continue;
    }

    const matched = matchBucket(text, bucket);
    if (matched.length === 0) {
      continue;
    }

    matches.push({
      section: sectionKey,
      tier,
      source,
      weight: bucket.weight ?? 0,
      note: bucket.notes,
      matched,
    });
  }

  return matches;
}

function matchBucket(text: string, bucket: DictionaryBucket): DictionaryMatch[] {
  const matches: DictionaryMatch[] = [];

  for (const keyword of bucket.keywords ?? []) {
    if (text.includes(normalizeText(keyword))) {
      matches.push({ sourceType: "keyword", value: keyword });
    }
  }

  for (const phrase of bucket.phrases ?? []) {
    if (text.includes(normalizeText(phrase))) {
      matches.push({ sourceType: "phrase", value: phrase });
    }
  }

  for (const regex of bucket.regexPatterns ?? []) {
    if (regex.test(text)) {
      matches.push({ sourceType: "regex", value: regex.source });
    }
  }

  return dedupeMatches(matches);
}

function deriveFinancialSignal(signals: MatchedDictionarySignal[]): NoteSignals["financialSignal"] {
  const strongSignals = signals.filter((signal) => signal.tier === "strong");

  if (strongSignals.some((signal) => signalHasAnyHint(signal, VERIFIED_FINANCIAL_HINTS))) {
    return "verified_funds";
  }

  if (
    strongSignals.some((signal) => signalHasAnyHint(signal, STRONG_FINANCIAL_HINTS)) ||
    hasTier(signals, "medium") ||
    hasTier(signals, "sellerSignals")
  ) {
    return "strong_signal";
  }

  return null;
}

function deriveUrgencySignal(
  timeline: StructuredTimelineSignal,
  signals: MatchedDictionarySignal[],
): NoteSignals["urgencySignal"] {
  const primary = timeline.primarySignal;

  if (primary?.tier === "strong") {
    return "immediate";
  }

  if (primary?.tier === "medium") {
    if (signalHasAnyHint(primary, ["2", "3", "30", "45", "60", "90", "within 3 months", "next 2 to 3 months"])) {
      return "under_3_months";
    }

    return "three_to_six_months";
  }

  if (primary?.tier === "weak") {
    return "six_to_twelve_months";
  }

  if (hasTier(signals, "negative")) {
    return "browsing";
  }

  return null;
}

function deriveIntentSignal(signals: MatchedDictionarySignal[]): NoteSignals["intentSignal"] {
  const strong = signals.find((signal) => signal.tier === "strong");

  if (strong && signalHasAnyHint(strong, SHOWING_INTENT_HINTS)) {
    return "requested_showing";
  }

  if (strong && signalHasAnyHint(strong, PROPERTY_QUESTION_HINTS)) {
    return "property_questions";
  }

  if ((strong && signalHasAnyHint(strong, ENGAGEMENT_HINTS)) || hasTier(signals, "medium")) {
    return "engaged";
  }

  if (hasTier(signals, "weak")) {
    return "general_inquiry";
  }

  if (hasTier(signals, "negative")) {
    return "browsing";
  }

  return null;
}

function extractBudgetSignal(
  budgetText: string,
  financialSignals: MatchedDictionarySignal[],
): StructuredBudgetSignal {
  const hasBudget = budgetText.length > 0;
  const budgetPatterns = dictionary.globalRegexLibrary.budgetPatterns;
  const isSpecific = budgetPatterns.some((pattern) => pattern.test(budgetText));
  const isVague = hasBudget && !isSpecific;
  const reinforcedByNotes =
    hasTier(financialSignals, "medium") ||
    hasTier(financialSignals, "strong") ||
    financialSignals.some((signal) =>
      signal.matched.some((match) =>
        dictionary.globalRegexLibrary.budgetPatterns.some((pattern) => pattern.test(normalizeText(match.value))),
      ),
    );

  return {
    hasBudget,
    isSpecific,
    isVague,
    reinforcedByNotes,
  };
}

function extractTimelineSignal(
  timelineText: string,
  notesText: string,
  signals: MatchedDictionarySignal[],
): StructuredTimelineSignal {
  const timelineSignal = selectPrimaryTier(signals.filter((signal) => signal.source === "timeline"));
  const notesSignal = selectPrimaryTier(signals.filter((signal) => signal.source === "notes"));

  if (timelineSignal && notesSignal && timelineSignal.tier !== notesSignal.tier) {
    return {
      source: "timeline",
      primaryTier: timelineSignal.tier,
      primarySignal: timelineSignal,
      contradiction: true,
    };
  }

  if (timelineSignal) {
    return {
      source: "timeline",
      primaryTier: timelineSignal.tier,
      primarySignal: timelineSignal,
      contradiction: false,
    };
  }

  if (notesSignal) {
    return {
      source: "notes",
      primaryTier: notesSignal.tier,
      primarySignal: notesSignal,
      contradiction: false,
    };
  }

  if (
    dictionary.globalRegexLibrary.timelinePatterns.some((pattern) => pattern.test(timelineText || notesText))
  ) {
    return {
      source: "combined",
      primaryTier: "medium",
      primarySignal: null,
      contradiction: false,
    };
  }

  return {
    source: "combined",
    primaryTier: null,
    primarySignal: null,
    contradiction: false,
  };
}

function collectContradictions(input: {
  combinedText: string;
  matchedSignals: Record<DictionarySectionKey, MatchedDictionarySignal[]>;
  timelineText: string;
  budgetText: string;
}) {
  const contradictions = new Set<string>();

  for (const sectionKey of DICTIONARY_SECTIONS) {
    const signals = input.matchedSignals[sectionKey];
    if (hasPositiveSignal(signals) && hasTier(signals, "negative")) {
      contradictions.add(`${sectionLabel(sectionKey)} has both positive and negative signals.`);
    }

    for (const conflict of dictionary[sectionKey].conflictSignals ?? []) {
      const parts = conflict.split("+").map((part) => normalizeText(part));
      if (parts.every((part) => input.combinedText.includes(part))) {
        contradictions.add(`${sectionLabel(sectionKey)} conflict: ${conflict}.`);
      }
    }
  }

  if (
    input.timelineText &&
    hasTier(input.matchedSignals.urgencyTimeline.filter((signal) => signal.source === "timeline"), "strong") &&
    hasTier(input.matchedSignals.urgencyTimeline.filter((signal) => signal.source === "notes"), "negative")
  ) {
    contradictions.add("Timeline field suggests urgency, but notes suggest the lead is delayed or just browsing.");
  }

  if (
    input.budgetText &&
    dictionary.globalRegexLibrary.budgetPatterns.some((pattern) => pattern.test(input.budgetText)) &&
    hasTier(input.matchedSignals.financialReadiness, "negative")
  ) {
    contradictions.add("Budget is present, but financial notes suggest qualification or affordability problems.");
  }

  return Array.from(contradictions);
}

function hasLocationSignal(signals: MatchedDictionarySignal[], notesText: string) {
  return (
    signals.some((signal) => signalHasAnyHint(signal, LOCATION_HINTS)) ||
    dictionary.globalRegexLibrary.locationPatterns.some((pattern) => pattern.test(notesText))
  );
}

function extractPropertyType(signals: MatchedDictionarySignal[]) {
  for (const signal of signals) {
    for (const hint of PROPERTY_TYPE_HINTS) {
      if (signalHasAnyHint(signal, [hint])) {
        return hint;
      }
    }
  }

  return null;
}

function hasConstraintSignal(signals: MatchedDictionarySignal[], notesText: string) {
  return (
    signals.some((signal) => signalHasAnyHint(signal, CONSTRAINT_HINTS)) ||
    dictionary.globalRegexLibrary.bedBathPatterns.some((pattern) => pattern.test(notesText))
  );
}

function hasVagueFitSignal(signals: MatchedDictionarySignal[]) {
  return signals.some((signal) => signal.tier === "weak" || signal.tier === "negative");
}

function countStrongSignals(signals: Record<DictionarySectionKey, MatchedDictionarySignal[]>) {
  return Object.values(signals)
    .flat()
    .filter((signal) => signal.tier === "strong" || signal.tier === "sellerSignals").length;
}

function flattenMatchedTerms(signals: Record<DictionarySectionKey, MatchedDictionarySignal[]>) {
  return Array.from(
    new Set(
      Object.values(signals)
        .flat()
        .flatMap((signal) => signal.matched.map((match) => match.value)),
    ),
  );
}

function selectPrimaryTier(signals: MatchedDictionarySignal[]) {
  const priority: DictionaryTierName[] = ["negative", "strong", "medium", "weak", "sellerSignals"];

  for (const tier of priority) {
    const signal = signals.find((candidate) => candidate.tier === tier);
    if (signal) {
      return signal;
    }
  }

  return null;
}

function hasPositiveSignal(signals: MatchedDictionarySignal[]) {
  return signals.some((signal) =>
    signal.tier === "strong" ||
    signal.tier === "medium" ||
    signal.tier === "weak" ||
    signal.tier === "sellerSignals",
  );
}

function hasTier(signals: MatchedDictionarySignal[], tier: DictionaryTierName) {
  return signals.some((signal) => signal.tier === tier);
}

function signalHasAnyHint(signal: MatchedDictionarySignal, hints: string[]) {
  const normalizedHints = hints.map((hint) => normalizeText(hint));

  return signal.matched.some((match) => {
    const value = normalizeText(match.value);
    return normalizedHints.some((hint) => value.includes(hint));
  });
}

function buildExplanation(input: {
  financialReadiness: CategoryScore;
  urgency: CategoryScore;
  behavioralIntent: CategoryScore;
  fitReadiness: CategoryScore;
  dataConfidence: CategoryScore;
  contradictions: string[];
}) {
  const explanation = [
    `Financial readiness: ${input.financialReadiness.points}/30. ${input.financialReadiness.reason}`,
    `Urgency: ${input.urgency.points}/25. ${input.urgency.reason}`,
    `Behavioral intent: ${input.behavioralIntent.points}/20. ${input.behavioralIntent.reason}`,
    `Fit readiness: ${input.fitReadiness.points}/15. ${input.fitReadiness.reason}`,
    `Data confidence: ${input.dataConfidence.points}/10. ${input.dataConfidence.reason}`,
  ];

  if (input.contradictions.length > 0) {
    explanation.push(`Contradictions: ${input.contradictions.join(" ")}`);
  }

  return explanation;
}

function dedupeMatches(matches: DictionaryMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.sourceType}:${match.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sectionLabel(sectionKey: DictionarySectionKey) {
  switch (sectionKey) {
    case "financialReadiness":
      return "Financial readiness";
    case "urgencyTimeline":
      return "Urgency";
    case "behavioralIntent":
      return "Behavioral intent";
    case "fitReadiness":
      return "Fit readiness";
    case "dataConfidence":
      return "Data confidence";
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
