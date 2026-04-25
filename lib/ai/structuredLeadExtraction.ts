export type StructuredLeadContradiction = {
  field: string;
  notes_value: string;
  email_value: string;
  reason: string;
};

/** One row per email when using per-email extraction + time weighting */
export type PerEmailSignalRow = {
  received_at: string;
  intent_level: "high" | "medium" | "low";
  urgency: "high" | "medium" | "low";
  timeline: string | null;
  key_phrases: string[];
  budget: number | null;
};

export type StructuredLeadExtraction = {
  budget: number | null;
  timeline: string | null;
  intent_level: "high" | "medium" | "low";
  urgency: "high" | "medium" | "low";
  phone: string | null;
  key_needs: string[];
  summary: string;
  contradictions: StructuredLeadContradiction[];
  confidence_score: number;
  confidence_reasoning: string[];
  /** Present when thread was scored with time-weighted per-email extraction */
  per_email_signals?: PerEmailSignalRow[];
  /** Intent/urgency evolution across the thread — informational, not a factual conflict */
  intent_temporal_shift?: string | null;
};

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4.1-mini";

const STRUCTURED_EXTRACTION_SCHEMA = {
  budget: "number | null",
  timeline: "string | null",
  intent_level: "high | medium | low",
  urgency: "high | medium | low",
  phone: "string | null",
  key_needs: "string[]",
  summary: "string",
  contradictions: [
    {
      field: "string",
      notes_value: "string",
      email_value: "string",
      reason: "string",
    },
  ],
  confidence_score: "number",
  confidence_reasoning: "string[]",
};

const STRUCTURED_EXTRACTION_PROMPT = `You are a lead intelligence extractor for real-estate CRM data.

Use BOTH sources:
1) lead notes
2) combined email thread text

Return JSON ONLY with this exact schema:
${JSON.stringify(STRUCTURED_EXTRACTION_SCHEMA, null, 2)}

Rules:
- Do not hallucinate missing fields; use null when missing.
- Do not assume notes are correct; compare notes vs emails.
- If conflicts exist, populate contradictions[] and lower confidence_score.
- confidence_score must be 0..1.
- Keep key_needs concise and grounded in the input.
- Output valid JSON only.`;

export async function extractStructuredLeadSignalsWithAI({
  notes,
  emailThread,
}: {
  notes: string;
  emailThread: string;
}): Promise<StructuredLeadExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

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
        { role: "system", content: STRUCTURED_EXTRACTION_PROMPT },
        {
          role: "user",
          content: JSON.stringify(
            {
              lead_notes: notes,
              email_thread: emailThread,
            },
            null,
            2,
          ),
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

  return normalizeStructuredExtraction(JSON.parse(content));
}

function normalizeStructuredExtraction(value: unknown): StructuredLeadExtraction {
  if (!isRecord(value)) {
    throw new Error("Structured extraction response was not a JSON object");
  }

  const contradictionsInput = Array.isArray(value.contradictions) ? value.contradictions : [];
  const contradictions: StructuredLeadContradiction[] = contradictionsInput
    .filter(isRecord)
    .map((row) => ({
      field: readString(row.field, ""),
      notes_value: readString(row.notes_value, ""),
      email_value: readString(row.email_value, ""),
      reason: readString(row.reason, ""),
    }))
    .filter((row) => row.field || row.reason);

  const perEmailRaw = Array.isArray(value.per_email_signals) ? value.per_email_signals : null;
  const per_email_signals =
    perEmailRaw?.filter(isRecord).map((row) => ({
      received_at: readString(row.received_at, ""),
      intent_level: normalizeLevel(row.intent_level),
      urgency: normalizeLevel(row.urgency),
      timeline: normalizeNullableString(row.timeline),
      key_phrases: readStringArray(row.key_phrases),
      budget: normalizeOptionalNumber(row.budget),
    })) ?? undefined;

  return {
    budget: normalizeOptionalNumber(value.budget),
    timeline: normalizeNullableString(value.timeline),
    intent_level: normalizeLevel(value.intent_level),
    urgency: normalizeLevel(value.urgency),
    phone: normalizeNullableString(value.phone),
    key_needs: readStringArray(value.key_needs),
    summary: readString(value.summary, ""),
    contradictions,
    confidence_score: normalizeConfidence(value.confidence_score),
    confidence_reasoning: readStringArray(value.confidence_reasoning),
    per_email_signals,
    intent_temporal_shift: normalizeNullableString(value.intent_temporal_shift),
  };
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeLevel(value: unknown): "high" | "medium" | "low" {
  const s = readString(value, "medium").toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
}

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
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
