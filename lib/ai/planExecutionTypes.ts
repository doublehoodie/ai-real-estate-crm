import type { ActionPlan, ActionPlanStep } from "@/lib/ai/actionPlanTypes";
import type { Lead } from "@/types/lead";

/**
 * Runtime context for executing assistant plan steps (no AI).
 * Provide `fetchApi` for same-origin API calls (browser: relative paths + credentials).
 * Provide `origin` when calling from the server so `/api/...` can be resolved to absolute URLs.
 */
export type PlanExecutionContext = {
  lead: Lead;
  /** Draft produced by `draft_message` or preset on context for `send_message`. */
  messageDraft?: string;
  /** Optional subject for outbound email (defaults to a simple Re: line). */
  emailSubject?: string;
  /**
   * Fetch implementation for calling app routes (e.g. `fetch` with cookies).
   * Signature matches `fetch` for `/api/...` paths.
   */
  fetchApi?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  /** e.g. `process.env.NEXT_PUBLIC_SITE_URL` — used with `fetchApi` for relative paths on the server. */
  origin?: string;
};

export type ConfirmationRequiredResult = {
  type: "confirmation_required";
  step: ActionPlanStep;
  previewData: unknown;
};

export type PlanCompletedResult = {
  type: "completed";
  stepResults: Array<{ step: ActionPlanStep; result: unknown }>;
};

export type ExecutePlanResult = ConfirmationRequiredResult | PlanCompletedResult;
