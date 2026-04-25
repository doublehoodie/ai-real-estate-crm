import type { PerEmailSignalRow, StructuredLeadContradiction } from "@/lib/ai/structuredLeadExtraction";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4.1-mini";

export type PerEmailStructuredExtractionResult = {
  per_email: PerEmailSignalRow[];
  budget: number | null;
  summary: string;
  notes_factual_contradictions: StructuredLeadContradiction[];
  /** Human-readable; use when intent changes over time — NOT a factual conflict */
  intent_temporal_shift: string | null;
  latest_indicates_downgrade: boolean;
  confidence_score: number;
  confidence_reasoning: string[];
};

const SCHEMA = {
  per_email: [
    {
      received_at: "string (ISO, must match each input email)",
      intent_level: "high | medium | low",
      urgency: "high | medium | low",
      timeline: "string | null",
      key_phrases: "string[]",
      budget: "number | null",
    },
  ],
  budget: "number | null (prefer latest email if stated)",
  summary: "string",
  notes_factual_contradictions: [
    {
      field: "string",
      notes_value: "string",
      email_value: "string",
      reason: "string",
    },
  ],
  intent_temporal_shift:
    "string | null — If intent or urgency clearly changed across emails over time, describe it (e.g. 'Intent has shifted from high to low over time'). Do NOT label this as a contradiction. Use null if stable or unclear.",
  latest_indicates_downgrade:
    "boolean — true if the NEWEST email shows cooled interest, browsing-only, not ready, or stepping back",
  confidence_score: "number 0..1",
  confidence_reasoning: "string[]",
};

const SYSTEM = `You are a real-estate lead signal extractor.

You receive ordered emails (oldest to newest) and optional lead notes.

Return JSON ONLY with this schema:
${JSON.stringify(SCHEMA, null, 2)}

Rules:
- Extract intent_level, urgency, timeline, key_phrases, and budget PER EMAIL from that email's text.
- Newer emails should be interpreted in context of the thread; rate each email on its own wording.
- notes_factual_contradictions: ONLY concrete mismatches between lead notes and email facts (e.g. budget, location). Do NOT put "intent changed over time" here — use intent_temporal_shift instead.
- If intent weakens in newer emails, set intent_temporal_shift with a clear sentence (e.g. "Intent has shifted from high to low over time") and latest_indicates_downgrade when appropriate.
- Do not hallucinate budgets; use null when absent.
- Output valid JSON only.`;

export async function extractPerEmailStructuredSignalsWithAI(input: {
  notes: string;
  emails: { received_at: string; text: string }[];
}): Promise<PerEmailStructuredExtractionResult> {
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
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify(
            {
              lead_notes: input.notes || "",
              emails: input.emails.map((e) => ({
                received_at: e.received_at,
                text: e.text,
              })),
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

  return normalizePerEmailResult(JSON.parse(content));
}

function normalizePerEmailResult(value: unknown): PerEmailStructuredExtractionResult {
  if (!isRecord(value)) {
    throw new Error("Per-email extraction response was not a JSON object");
  }

  const perRaw = Array.isArray(value.per_email) ? value.per_email : [];
  const per_email: PerEmailSignalRow[] = perRaw.filter(isRecord).map((row) => ({
    received_at: readString(row.received_at, ""),
    intent_level: normalizeLevel(row.intent_level),
    urgency: normalizeLevel(row.urgency),
    timeline: normalizeNullableString(row.timeline),
    key_phrases: readStringArray(row.key_phrases),
    budget: normalizeOptionalNumber(row.budget),
  }));

  const notes_factual_contradictions = normalizeContradictions(value.notes_factual_contradictions);

  return {
    per_email,
    budget: normalizeOptionalNumber(value.budget),
    summary: readString(value.summary, ""),
    notes_factual_contradictions,
    intent_temporal_shift: normalizeNullableString(value.intent_temporal_shift),
    latest_indicates_downgrade: Boolean(value.latest_indicates_downgrade),
    confidence_score: normalizeConfidence(value.confidence_score),
    confidence_reasoning: readStringArray(value.confidence_reasoning),
  };
}

function normalizeContradictions(value: unknown): StructuredLeadContradiction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      field: readString(row.field, ""),
      notes_value: readString(row.notes_value, ""),
      email_value: readString(row.email_value, ""),
      reason: readString(row.reason, ""),
    }))
    .filter((row) => row.field || row.reason);
}

function normalizeLevel(value: unknown): "high" | "medium" | "low" {
  const s = readString(value, "medium").toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
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

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, Number(normalized.toFixed(2))));
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
