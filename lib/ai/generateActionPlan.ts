import type { ActionPlan, ActionPlanStep, AllowedAction, AssistantContext, PlanIntent } from "@/lib/ai/actionPlanTypes";
import { ALLOWED_ACTIONS, ALLOWED_INTENTS } from "@/lib/ai/actionPlanTypes";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4.1-mini";

const MESSAGE_PREFIX = "Recommended next step:";

/** First segment after the prefix must be one of these action openers, then an em/en dash, then the reason. */
const MESSAGE_ACTION_OPENERS = ["Follow up", "Schedule", "Review", "Clarify"] as const;

const SYSTEM_PROMPT = `You are the GrassLeads Assistant. Speak in first person as the assistant helping an agent. Never describe "the user" or paraphrase user input with phrases like "User wants", "User input is", "The user intends", or similar meta-language.

Return ONE JSON object only (no markdown, no prose outside JSON).

---

Allowed "intent" values — use EXACTLY one string, nothing else:
- follow_up — follow-up email or touchpoint (simple: 1–2 plan steps)
- schedule_meeting — scheduling / calendar (simple: 1–2 plan steps)
- multi_step — follow-up AND scheduling or multiple concrete actions (compound: 2–3 plan steps)
- view_only — browsing, unclear ask, or no immediate CRM action (always 1 step: view_details)
- clarification — need more information before acting (1–2 plan steps)

---

Allowed "plan[].action" values (do not invent others):
draft_message, send_message, suggest_time, create_event, update_notes, view_details

---

Plan size rules:
- follow_up, schedule_meeting: 1–2 steps (e.g. follow up → often [draft_message]; schedule → often [suggest_time, create_event] or [suggest_time] alone)
- multi_step: 2–3 steps (e.g. follow up and schedule → [draft_message, suggest_time] or [draft_message, suggest_time, create_event])
- view_only: exactly 1 step, action must be view_details
- clarification: 1–2 steps

---

The "message" field MUST follow this exact pattern (use an em dash — between action and reason):
${MESSAGE_PREFIX} {Action verb} — {Reason}

Rules for "message":
- After the prefix, start with ONE of these action openers (exact wording, capital F/S/R/C as shown): Follow up / Schedule / Review / Clarify
- Then a space, an em dash (—), a space, then a short reason
- The reason must NOT begin with "The lead is" or similar — write the reason directly (e.g. comparing options, ready to tour, needs HOA numbers)

Examples:
"${MESSAGE_PREFIX} Follow up — comparing HOA fees on the two listings and waiting on your comparison sheet."
"${MESSAGE_PREFIX} Schedule — ready to lock a second showing this weekend."
"${MESSAGE_PREFIX} Review — signals look mixed; worth scanning notes before replying."
"${MESSAGE_PREFIX} Clarify — budget range still ambiguous from the last thread."

---

JSON shape:
{
  "intent": "<one of the five allowed intent strings>",
  "message": "${MESSAGE_PREFIX} …",
  "plan": [
    { "action": "<allowed action>", "requiresConfirmation": true or false, "ui": "short UI label" }
  ]
}

Max 3 items in "plan".`;

/** When there is no usable request (empty input). */
export const VIEW_ONLY_FALLBACK: ActionPlan = {
  intent: "view_only",
  message: "No immediate action needed. Review this lead before proceeding.",
  plan: [
    {
      action: "view_details",
      requiresConfirmation: false,
      ui: "View details",
    },
  ],
};

/**
 * When the model output is invalid or the request could not be planned.
 * Does not use the "Recommended next step:" line — instructional copy for the agent.
 */
export const CLARIFICATION_UNCLEAR_FALLBACK: ActionPlan = {
  intent: "clarification",
  message:
    "I didn't understand that. You can say follow up, schedule a meeting, or review details.",
  plan: [
    {
      action: "view_details",
      requiresConfirmation: false,
      ui: "View details",
    },
  ],
};

const FORBIDDEN_MESSAGE_PATTERNS = [/user wants/i, /user input is/i, /the user intends/i];

function isAllowedAction(x: unknown): x is AllowedAction {
  return typeof x === "string" && (ALLOWED_ACTIONS as readonly string[]).includes(x);
}

function isAllowedIntent(x: unknown): x is PlanIntent {
  return typeof x === "string" && (ALLOWED_INTENTS as readonly string[]).includes(x);
}

function messageHasForbiddenPhrasing(message: string): boolean {
  return FORBIDDEN_MESSAGE_PATTERNS.some((re) => re.test(message));
}

/**
 * Enforces: "Recommended next step: {Follow up|Schedule|Review|Clarify} — {reason}"
 * Reason must not start with "The lead is".
 */
function messageMatchesStructuredFormat(message: string): boolean {
  const t = message.trim();
  if (!t.startsWith(MESSAGE_PREFIX)) return false;

  let rest = t.slice(MESSAGE_PREFIX.length).trimStart();
  const opener = MESSAGE_ACTION_OPENERS.find((a) => rest.startsWith(a));
  if (!opener) return false;

  rest = rest.slice(opener.length).trimStart();
  if (!rest.length) return false;

  const dash = rest[0];
  if (dash !== "—" && dash !== "–" && dash !== "-") return false;
  rest = rest.slice(1).trimStart();
  if (!rest.length) return false;

  if (/^The lead is\b/i.test(rest)) return false;

  return true;
}

/**
 * Intent-specific plan shape rules (predictable UI-safe behavior).
 */
function planMatchesIntentRules(intent: PlanIntent, plan: ActionPlanStep[]): boolean {
  const n = plan.length;
  if (n < 1 || n > 3) return false;

  switch (intent) {
    case "multi_step":
      return n >= 2 && n <= 3;
    case "follow_up":
    case "schedule_meeting":
      return n >= 1 && n <= 2;
    case "view_only":
      return n === 1 && plan[0].action === "view_details";
    case "clarification":
      return n >= 1 && n <= 2;
    default:
      return false;
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence) return fence[1].trim();
  const i = trimmed.indexOf("{");
  const j = trimmed.lastIndexOf("}");
  if (i >= 0 && j > i) return trimmed.slice(i, j + 1);
  return trimmed;
}

function parseJsonSafe(raw: string): unknown {
  const blob = extractJsonObject(raw);
  return JSON.parse(blob) as unknown;
}

function validateActionPlan(parsed: unknown): ActionPlan | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const intent = o.intent;
  const message = o.message;
  const planRaw = o.plan;
  if (!isAllowedIntent(intent)) return null;
  if (typeof message !== "string") return null;
  const msgTrim = message.trim();
  if (!messageMatchesStructuredFormat(msgTrim)) return null;
  if (messageHasForbiddenPhrasing(msgTrim)) return null;
  if (!Array.isArray(planRaw) || planRaw.length === 0 || planRaw.length > 3) return null;

  const plan: ActionPlanStep[] = [];
  for (const step of planRaw) {
    if (!step || typeof step !== "object") return null;
    const s = step as Record<string, unknown>;
    if (!isAllowedAction(s.action)) return null;
    if (typeof s.requiresConfirmation !== "boolean") return null;
    if (typeof s.ui !== "string" || !s.ui.trim()) return null;
    plan.push({
      action: s.action,
      requiresConfirmation: s.requiresConfirmation,
      ui: s.ui.trim(),
    });
  }

  if (!planMatchesIntentRules(intent, plan)) return null;

  return { intent, message: msgTrim, plan };
}

export function getFallbackActionPlan(): ActionPlan {
  return VIEW_ONLY_FALLBACK;
}

export function getClarificationUnclearFallback(): ActionPlan {
  return CLARIFICATION_UNCLEAR_FALLBACK;
}

/**
 * Calls OpenAI and returns a validated action plan, or a safe fallback when output is invalid.
 */
export async function generateActionPlan(context: AssistantContext, userInput: string): Promise<ActionPlan> {
  const trimmed = userInput.trim();
  if (!trimmed) {
    console.log("[AI PLAN INPUT]", { userInput: "", context });
    console.log("[AI PLAN RAW OUTPUT]", "");
    console.log("[AI PLAN FINAL]", VIEW_ONLY_FALLBACK);
    return VIEW_ONLY_FALLBACK;
  }

  console.log("[AI PLAN INPUT]", { userInput: trimmed, context });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[AI PLAN] OPENAI_API_KEY missing; using clarification fallback plan.");
    console.log("[AI PLAN RAW OUTPUT]", "");
    console.log("[AI PLAN FINAL]", CLARIFICATION_UNCLEAR_FALLBACK);
    return CLARIFICATION_UNCLEAR_FALLBACK;
  }

  const contextPrompt = `Context (JSON):\n${JSON.stringify(context, null, 2)}\n\nAgent request:\n${trimmed}`;

  let rawResponse = "";
  try {
    console.log("=== ASSISTANT INPUT CONTEXT ===");
    console.log(JSON.stringify(context, null, 2));

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextPrompt },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
    }

    rawResponse = payload.choices?.[0]?.message?.content ?? "";
    if (!rawResponse) {
      throw new Error("OpenAI response did not include message content");
    }

    console.log("[AI PLAN RAW OUTPUT]", rawResponse);

    const parsed = parseJsonSafe(rawResponse);
    const validated = validateActionPlan(parsed);
    if (!validated) {
      console.log("[AI PLAN FINAL]", CLARIFICATION_UNCLEAR_FALLBACK);
      return CLARIFICATION_UNCLEAR_FALLBACK;
    }

    console.log("[AI PLAN FINAL]", validated);
    return validated;
  } catch (e) {
    console.error("[AI PLAN] error", e);
    console.log("[AI PLAN RAW OUTPUT]", rawResponse);
    console.log("[AI PLAN FINAL]", CLARIFICATION_UNCLEAR_FALLBACK);
    return CLARIFICATION_UNCLEAR_FALLBACK;
  }
}
