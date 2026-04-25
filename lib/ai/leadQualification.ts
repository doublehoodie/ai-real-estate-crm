import type { Lead } from "@/types/lead";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractStructuredLeadSignalsWithAI,
  type StructuredLeadExtraction,
} from "@/lib/ai/structuredLeadExtraction";
import { fetchLeadEmailsForScoring } from "@/lib/ai/leadEmailsForScoring";
import { extractPerEmailStructuredSignalsWithAI } from "@/lib/ai/perEmailStructuredExtraction";
import { mergePerEmailIntoStructuredLeadExtraction } from "@/lib/ai/timeWeightedMerge";
import { computeDeterministicAiScore } from "@/lib/ai/deterministicAiScoring";
import { computeAiScoreFromBreakdown } from "@/lib/scoring";
import {
  buildResolvedEmailFromParts,
  getAggregatedEmailThreadForLead,
} from "@/lib/inbox/getBestEmailBodyForLead";
import {
  getConcatenatedEmailTextAfter,
  getLatestEmailReceivedAt,
  shouldRecomputeAiForLead,
} from "@/lib/ai/aiEmailFreshness";

export type LeadQualificationInput = {
  lead: Partial<Lead>;
  rawTranscript?: string;
  notes?: string;
};

export type LeadQualificationSuggestion = {
  suggestedBudget?: string | null;
  suggestedTimeline?: string | null;
  suggestedScore?: number | null;
  reasoning?: string;
};

export type AiLeadSignals = {
  financial_readiness: string[];
  urgency: string[];
  intent: string[];
  fit: string[];
  objections: string[];
  missing_info: string[];
  structured_extraction?: Record<string, unknown>;
};

export type AiLeadNextAction = {
  action: string;
  priority: "low" | "medium" | "high";
  reason: string;
};

export type AiLeadQualification = {
  summary: string;
  intent_level: "low" | "medium" | "high";
  score: number;
  confidence: number;
  signals: AiLeadSignals;
  next_action: AiLeadNextAction;
  followup: string;
};

export type ProcessLeadQualificationResult =
  | { status: "processed"; leadId: string; qualification: AiLeadQualification }
  | { status: "skipped"; leadId: string; reason: string };

type ProcessLeadQualificationInput = {
  supabase: SupabaseClient;
  userId: string;
  leadId: string;
  emailBody: string;
};

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4.1-mini";

const AI_OUTPUT_SCHEMA = {
  summary: "string: concise 1-2 sentence lead summary",
  intent_level: "low | medium | high",
  score: "integer from 0 to 100",
  confidence: "number from 0 to 1",
  signals: {
    financial_readiness: "string[]",
    urgency: "string[]",
    intent: "string[]",
    fit: "string[]",
    objections: "string[]",
    missing_info: "string[]",
  },
  next_action: {
    action: "string: recommended next CRM action",
    priority: "low | medium | high",
    reason: "string: why this action should happen",
  },
  followup: "string: short suggested follow-up message",
};

const SYSTEM_PROMPT = `You are an AI sales assistant specializing in real estate lead qualification.

Analyze the input and return JSON with this structure:
${JSON.stringify(AI_OUTPUT_SCHEMA, null, 2)}

Rules:
- Output valid JSON only
- No explanations outside JSON
- Infer missing fields when possible
- Be decisive (do not be vague)
- Score is lead readiness, not guaranteed close probability
- Confidence must reflect how complete and specific the email is`;

/**
 * Placeholder for future AI-powered lead qualification.
 *
 * In the future, this function will call an LLM to:
 * - analyze raw lead text or conversation transcripts
 * - extract budget, timeline, and intent
 * - suggest an updated lead score and status
 */
export async function suggestLeadQualification(
  _input: LeadQualificationInput,
): Promise<LeadQualificationSuggestion> {
  void _input;

  // For now we simply return an empty suggestion so the rest of the app
  // can depend on this function without introducing AI complexity yet.
  return {};
}

export async function processLeadQualificationWithAI({
  supabase,
  userId,
  leadId,
  emailBody,
}: ProcessLeadQualificationInput): Promise<ProcessLeadQualificationResult> {
  const hintFromCaller = (emailBody ?? "").trim();

  const [threadCombinedRaw, leadResult, latestEmailReceivedAt] = await Promise.all([
    getAggregatedEmailThreadForLead(supabase, userId, leadId),
    supabase
      .from("leads")
      .select("id, ai_processed, ai_last_processed_at, ai_summary, ai_score, notes")
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle(),
    getLatestEmailReceivedAt(supabase, userId, leadId),
  ]);

  const { data: lead, error: leadError } = leadResult;

  if (leadError) {
    console.error("[AI lead qualification] lead lookup failed:", leadError);
    return { status: "skipped", leadId, reason: "lead_lookup_failed" };
  }

  if (!lead?.id) {
    return { status: "skipped", leadId, reason: "lead_not_found" };
  }

  let newEmailsDeltaText = "";
  if (lead.ai_processed === true && lead.ai_last_processed_at) {
    newEmailsDeltaText = await getConcatenatedEmailTextAfter(
      supabase,
      userId,
      leadId,
      lead.ai_last_processed_at,
    );
  }

  const hasNewEmailContent = shouldRecomputeAiForLead(
    lead.ai_processed,
    lead.ai_last_processed_at,
    latestEmailReceivedAt,
    newEmailsDeltaText,
    hintFromCaller.length,
  );

  console.log("AI CHECK:", {
    ai_processed: lead.ai_processed,
    ai_last_processed_at: lead.ai_last_processed_at,
    latestEmailReceivedAt,
    hasNewEmailContent,
    ai_summary: lead.ai_summary,
    ai_score: lead.ai_score,
  });

  if (lead.ai_processed === true && !hasNewEmailContent) {
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "already_processed_no_new_email",
      latestEmailReceivedAt,
      ai_last_processed_at: lead.ai_last_processed_at,
    });
    return {
      status: "skipped",
      leadId,
      reason: "already_processed_no_new_email",
    };
  }

  const threadCombined = (threadCombinedRaw ?? "").trim();

  console.log("[AI RAW EMAIL BODY]", {
    leadId,
    emailBodyRaw: hintFromCaller,
    length: hintFromCaller.length,
  });

  console.log("[AI THREAD INPUT]", {
    leadId,
    threadCombined,
    length: threadCombined.length,
    preview: threadCombined.slice(0, 300),
  });

  const resolved = buildResolvedEmailFromParts(threadCombinedRaw, emailBody);
  const emailBodyRaw = (resolved ?? "").trim();
  if (!emailBodyRaw) {
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "empty_email_body",
      emailBodyLength: emailBody?.length ?? 0,
    });
    return { status: "skipped", leadId, reason: "empty_email_body" };
  }

  let cleanedBody = cleanEmailBody(emailBodyRaw);
  console.log("[AI CLEANED INPUT]", {
    leadId,
    cleanedBody,
    length: cleanedBody?.length ?? 0,
  });

  if (!cleanedBody || cleanedBody.length < 20) {
    cleanedBody = emailBodyRaw;
  }

  if (!cleanedBody || cleanedBody.trim().length < 20) {
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "email_body_too_short_after_cleaning",
      emailBodyLength: emailBodyRaw.length,
      cleanedBodyLength: cleanedBody?.length ?? 0,
    });
    return { status: "skipped", leadId, reason: "email_body_too_short_after_cleaning" };
  }

  cleanedBody = cleanedBody.trim();

  if (!cleanedBody || cleanedBody.length < 50) {
    console.warn("[AI INPUT TOO SHORT]", { leadId, email_body: cleanedBody });
  }

  let qualification: AiLeadQualification;
  let structuredExtraction: StructuredLeadExtraction | Record<string, unknown> | null = null;
  let deterministicScore: ReturnType<typeof computeDeterministicAiScore> | null = null;
  try {
    console.log("[AI FINAL INPUT]", {
      leadId,
      preview: cleanedBody.slice(0, 500),
      length: cleanedBody.length,
    });
    const notes = (lead.notes as string | null | undefined)?.trim() ?? "";
    const emailRows = await fetchLeadEmailsForScoring(supabase, userId, leadId);
    const emailsForAi =
      emailRows.length > 0
        ? emailRows
        : [
            {
              received_at: latestEmailReceivedAt ?? new Date().toISOString(),
              text: cleanedBody,
            },
          ];

    try {
      const perEmailRaw = await extractPerEmailStructuredSignalsWithAI({
        notes,
        emails: emailsForAi,
      });
      if (!perEmailRaw.per_email?.length) {
        throw new Error("per-email extraction returned no rows");
      }
      structuredExtraction = mergePerEmailIntoStructuredLeadExtraction(perEmailRaw, emailsForAi);
    } catch (perEmailErr) {
      console.warn("[AI lead qualification] per-email extraction failed, using thread fallback:", perEmailErr);
      structuredExtraction = await extractStructuredLeadSignalsWithAI({
        notes,
        emailThread: cleanedBody,
      });
    }

    deterministicScore = computeDeterministicAiScore(structuredExtraction as StructuredLeadExtraction);
    console.log("[SCORING COMPUTED]", {
      leadId,
      score: deterministicScore.score,
      breakdown: deterministicScore.breakdown,
    });
  } catch (error) {
    console.error("[AI lead qualification] structured extraction failed:", error);
  }

  try {
    qualification = await generateLeadQualification(cleanedBody, leadId);
  } catch (error) {
    console.error("[AI lead qualification] generation failed:", error);
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "ai_generation_failed",
      emailBodyLength: emailBodyRaw.length,
    });
    return { status: "skipped", leadId, reason: "ai_generation_failed" };
  }

  const scoreBreakdownToPersist = deterministicScore?.breakdown ?? null;
  const computedScoreFromBreakdown = computeAiScoreFromBreakdown(scoreBreakdownToPersist);
  const scoreToPersist = computedScoreFromBreakdown ?? 0;
  const hasContradictionsToPersist = deterministicScore?.has_contradictions ?? false;
  const extractionRecord =
    structuredExtraction && typeof structuredExtraction === "object" && !Array.isArray(structuredExtraction)
      ? (structuredExtraction as Record<string, unknown>)
      : null;
  const extractedBudget = extractionRecord?.budget ?? null;
  const extractedPhone = extractionRecord?.phone ?? null;
  const aiSignalsToPersist = structuredExtraction
    ? { ...qualification.signals, structured_extraction: structuredExtraction }
    : qualification.signals;
  console.log("[DEBUG STORAGE]", {
    budget: extractedBudget,
    phone: extractedPhone,
    ai_signals: aiSignalsToPersist,
  });
  console.log("[SCORE DEBUG]", {
    ai_score: qualification.score,
    breakdown: scoreBreakdownToPersist,
    computedScore: computedScoreFromBreakdown,
  });
  console.log("[SCORING WRITE]", {
    leadId,
    ai_score: scoreToPersist,
    ai_score_breakdown: scoreBreakdownToPersist,
  });

  const processedAt = new Date().toISOString();

  let { data: updatedFields, error: updateError } = await supabase
    .from("leads")
    .update({
      ai_summary: qualification.summary,
      ai_intent_level: qualification.intent_level,
      ai_score: scoreToPersist,
      ai_confidence: qualification.confidence,
      ai_signals: aiSignalsToPersist,
      ai_next_action: qualification.next_action,
      ai_followup: qualification.followup,
      ai_score_breakdown: scoreBreakdownToPersist,
      has_contradictions: hasContradictionsToPersist,
      ai_processed: true,
      ai_last_processed_at: processedAt,
    })
    .eq("id", leadId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    const msg = updateError.message?.toLowerCase() ?? "";
    const missingScoreBreakdown = msg.includes("ai_score_breakdown") && msg.includes("column");
    const missingContradictions = msg.includes("has_contradictions") && msg.includes("column");
    const missingLastProcessed = msg.includes("ai_last_processed_at") && msg.includes("column");
    if (missingScoreBreakdown || missingContradictions || missingLastProcessed) {
      ({ data: updatedFields, error: updateError } = await supabase
        .from("leads")
        .update({
          ai_summary: qualification.summary,
          ai_intent_level: qualification.intent_level,
          ai_score: scoreToPersist,
          ai_confidence: qualification.confidence,
          ai_signals: aiSignalsToPersist,
          ai_next_action: qualification.next_action,
          ai_followup: qualification.followup,
          ai_processed: true,
          ...(missingLastProcessed ? {} : { ai_last_processed_at: processedAt }),
        })
        .eq("id", leadId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle());
    }
  }

  if (updateError) {
    console.error("SUPABASE UPDATE ERROR:", updateError);
    console.error("[AI lead qualification] lead update failed:", updateError);
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "lead_update_failed",
      emailBodyLength: emailBodyRaw.length,
    });
    return { status: "skipped", leadId, reason: "lead_update_failed" };
  }

  if (!updatedFields?.id) {
    console.log("[AI SKIP REASON]", {
      leadId,
      reason: "lead_update_failed",
      emailBodyLength: emailBodyRaw.length,
    });
    return { status: "skipped", leadId, reason: "lead_update_failed" };
  }

  console.log("AI SUCCESS for lead:", leadId);
  console.log("[AI RESULT SAVED]", leadId);

  return { status: "processed", leadId, qualification };
}

async function generateLeadQualification(
  emailBody: string,
  leadId: string,
): Promise<AiLeadQualification> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const raw = await callOpenAI(leadId, emailBody, attempt);
      return normalizeQualificationJson(JSON.parse(raw));
    } catch (error) {
      lastError = error;
      console.error(`[AI lead qualification] attempt ${attempt} failed:`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI lead qualification failed");
}

async function callOpenAI(leadId: string, emailBody: string, attempt: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log("[AI FINAL INPUT]", {
    leadId,
    preview: emailBody.slice(0, 500),
    length: emailBody.length,
  });

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            attempt === 1
              ? emailBody
              : `Return valid JSON only for this email:\n\n${emailBody}`,
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string | null } }[];
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not include message content");
  }

  return content;
}

function normalizeQualificationJson(value: unknown): AiLeadQualification {
  if (!isRecord(value)) {
    throw new Error("AI response was not a JSON object");
  }

  const qualification: AiLeadQualification = {
    summary: readString(value.summary, "No concise summary available."),
    intent_level: normalizeIntentLevel(value.intent_level),
    score: normalizeScore(value.score),
    confidence: normalizeConfidence(value.confidence),
    signals: normalizeSignals(value.signals),
    next_action: normalizeNextAction(value.next_action),
    followup: readString(value.followup, ""),
  };

  if (!qualification.summary || !qualification.followup) {
    throw new Error("AI response missing required summary or followup");
  }

  return qualification;
}

function normalizeSignals(value: unknown): AiLeadSignals {
  const record = isRecord(value) ? value : {};
  return {
    financial_readiness: readStringArray(record.financial_readiness),
    urgency: readStringArray(record.urgency),
    intent: readStringArray(record.intent),
    fit: readStringArray(record.fit),
    objections: readStringArray(record.objections),
    missing_info: readStringArray(record.missing_info),
  };
}

function normalizeNextAction(value: unknown): AiLeadNextAction {
  const record = isRecord(value) ? value : {};
  return {
    action: readString(record.action, "Follow up with the lead"),
    priority: normalizePriority(record.priority),
    reason: readString(record.reason, "AI identified this as the best next step."),
  };
}

function normalizeIntentLevel(value: unknown): AiLeadQualification["intent_level"] {
  const text = readString(value, "medium").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("low")) return "low";
  return "medium";
}

function normalizePriority(value: unknown): AiLeadNextAction["priority"] {
  const text = readString(value, "medium").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("low")) return "low";
  return "medium";
}

function normalizeScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("AI score was not numeric");
  }
  return clamp(Math.round(parsed), 0, 100);
}

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("AI confidence was not numeric");
  }
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return clamp(Number(normalized.toFixed(2)), 0, 1);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cleanEmailBody(body: string): string {
  if (!body) return "";

  let cleaned = body.trim();

  // Signatures (-- line); keep main content
  cleaned = cleaned.split(/\n--\s*\n/)[0] ?? cleaned;

  // Reply chains: only strip when a clear quoted-reply header appears after real content
  const replyMatch = cleaned.match(/\nOn [\s\S]{5,300}wrote:\s*\n/i);
  if (replyMatch && replyMatch.index != null && replyMatch.index >= 40) {
    cleaned = cleaned.slice(0, replyMatch.index);
  }

  const fromSent = cleaned.match(/\nFrom:\s*[^\n]+\n(?:Sent:|Date:)/i);
  if (fromSent && fromSent.index != null && fromSent.index >= 40) {
    cleaned = cleaned.slice(0, fromSent.index);
  }

  return cleaned.trim();
}
