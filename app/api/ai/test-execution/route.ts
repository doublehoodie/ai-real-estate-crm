import { NextRequest, NextResponse } from "next/server";
import type { ActionPlan, ActionPlanStep, AllowedAction, PlanIntent } from "@/lib/ai/actionPlanTypes";
import { ALLOWED_ACTIONS } from "@/lib/ai/actionPlanTypes";
import { executePlan } from "@/lib/ai/executePlan";
import type { PlanExecutionContext } from "@/lib/ai/planExecutionTypes";
import type { Lead } from "@/types/lead";

/** Default mock for execution tests (merged with optional `context` in POST body). */
const MOCK_LEAD: Lead = {
  id: "test-lead",
  name: "Test User",
  email: "test@example.com",
  phone: null,
  budget: null,
  timeline: null,
  status: "active",
  notes: null,
  ai_followup: "Hi — this is a test follow-up draft from the execution API.",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function isAllowedAction(x: unknown): x is AllowedAction {
  return typeof x === "string" && (ALLOWED_ACTIONS as readonly string[]).includes(x);
}

function normalizeStep(raw: unknown): ActionPlanStep | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isAllowedAction(o.action)) return null;
  const ui = typeof o.ui === "string" && o.ui.trim() ? o.ui.trim() : String(o.action);
  return {
    action: o.action,
    requiresConfirmation: Boolean(o.requiresConfirmation),
    ui,
  };
}

function isAllowedIntent(x: unknown): x is PlanIntent {
  const allowed = ["follow_up", "schedule_meeting", "multi_step", "view_only", "clarification"] as const;
  return typeof x === "string" && (allowed as readonly string[]).includes(x);
}

/**
 * Accepts either full `ActionPlan` or `{ steps: [...], intent?, message? }` for convenience.
 */
function normalizePlan(raw: unknown): ActionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const stepsRaw = p.steps;
  const planRaw = p.plan;

  let planSteps: ActionPlanStep[] | null = null;
  if (Array.isArray(stepsRaw)) {
    const mapped = stepsRaw.map(normalizeStep).filter(Boolean) as ActionPlanStep[];
    planSteps = mapped.length ? mapped : null;
  } else if (Array.isArray(planRaw)) {
    const mapped = planRaw.map(normalizeStep).filter(Boolean) as ActionPlanStep[];
    planSteps = mapped.length ? mapped : null;
  }
  if (!planSteps?.length) return null;

  const intent = isAllowedIntent(p.intent) ? p.intent : "follow_up";
  const message =
    typeof p.message === "string" && p.message.trim()
      ? p.message.trim()
      : "Recommended next step: Follow up — test execution.";

  return { intent, message, plan: planSteps };
}

function createServerFetch(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return (input: string | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    const url = path.startsWith("http://") || path.startsWith("https://") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        cookie: request.headers.get("cookie") ?? "",
      },
    });
  };
}

/**
 * Build `PlanExecutionContext` from optional client `context` + mock lead.
 * Supports flat `{ leadId, email, name }` or nested `{ lead: Partial<Lead> }`.
 */
function buildExecutionContext(request: NextRequest, bodyContext: unknown): PlanExecutionContext {
  let lead: Lead = { ...MOCK_LEAD };
  let messageDraft: string | undefined;
  let emailSubject: string | undefined;

  if (bodyContext && typeof bodyContext === "object") {
    const c = bodyContext as Record<string, unknown>;
    if (c.lead && typeof c.lead === "object") {
      lead = { ...lead, ...(c.lead as Partial<Lead>) };
    }
    if (typeof c.leadId === "string") lead = { ...lead, id: c.leadId };
    if (typeof c.name === "string") lead = { ...lead, name: c.name };
    if (typeof c.email === "string") lead = { ...lead, email: c.email };
    if (typeof c.messageDraft === "string") messageDraft = c.messageDraft;
    if (typeof c.emailSubject === "string") emailSubject = c.emailSubject;
  }

  return {
    lead,
    messageDraft,
    emailSubject,
    origin: request.nextUrl.origin,
    fetchApi: createServerFetch(request),
  };
}

type PostBody = {
  plan?: unknown;
  context?: unknown;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = normalizePlan(body.plan);
  if (!plan) {
    return NextResponse.json(
      { error: "Missing or invalid plan. Send ActionPlan or { steps: [...], intent?, message? }." },
      { status: 400 },
    );
  }

  const execContext = buildExecutionContext(request, body.context);

  console.log("[TEST EXECUTION INPUT]", plan);

  const result = await executePlan(plan, execContext);

  console.log("[TEST EXECUTION OUTPUT]", result);

  return NextResponse.json(result);
}
