import type { ActionPlan, ActionPlanStep, AllowedAction } from "@/lib/ai/actionPlanTypes";
import type {
  ExecutePlanResult,
  PlanCompletedResult,
  PlanExecutionContext,
} from "@/lib/ai/planExecutionTypes";
import {
  create_event,
  draft_message,
  send_message,
  suggest_time,
  update_notes,
  view_details,
} from "@/lib/ai/actionHandlers";

function logExecutionResult(result: unknown): void {
  console.log("[EXECUTION RESULT]", result);
}

/** Preview only — no email send, no calendar write, no notes write. */
async function confirmationPreview(step: ActionPlanStep, context: PlanExecutionContext): Promise<unknown> {
  switch (step.action) {
    case "draft_message": {
      const d = await draft_message(context);
      context.messageDraft = d.preview;
      return d;
    }
    case "send_message":
      return {
        previewSend: true,
        to: context.lead.email ?? null,
        subject: context.emailSubject?.trim() || `Following up — ${context.lead.name?.trim() || "Lead"}`,
        body: context.messageDraft?.trim() || context.lead.ai_followup?.trim() || "",
      };
    case "suggest_time":
      return suggest_time(context);
    case "create_event": {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 24);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      const name = context.lead.name?.trim() || "Lead";
      return {
        previewCreate: true,
        payload: {
          leadId: context.lead.id,
          type: "follow_up" as const,
          title: `Follow-up · ${name}`,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      };
    }
    case "update_notes": {
      const stamp = new Date().toISOString();
      const line = `[CRM Assistant ${stamp}] Quick note from assistant execution.`;
      const prev = context.lead.notes?.trim() ?? "";
      return {
        previewNotes: true,
        note: prev ? `${prev}\n${line}` : line,
      };
    }
    case "view_details":
      return view_details(context);
    default: {
      const _exhaustive: never = step.action;
      return _exhaustive;
    }
  }
}

async function runHandler(
  action: AllowedAction,
  context: PlanExecutionContext,
): Promise<unknown> {
  switch (action) {
    case "draft_message":
      return draft_message(context);
    case "send_message":
      return send_message(context);
    case "suggest_time":
      return suggest_time(context);
    case "create_event":
      return create_event(context);
    case "update_notes":
      return update_notes(context);
    case "view_details":
      return view_details(context);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Runs a single plan step (no AI). Mutates `context.messageDraft` when the step is `draft_message`.
 */
export async function executeStep(
  step: ActionPlanStep,
  context: PlanExecutionContext,
): Promise<unknown> {
  console.log("[EXECUTE STEP]", step);
  const result = await runHandler(step.action, context);
  if (step.action === "draft_message" && result && typeof result === "object" && "preview" in result) {
    const preview = (result as { preview: string }).preview;
    context.messageDraft = preview;
  }
  logExecutionResult(result);
  return result;
}

/**
 * Executes plan steps in order. Stops at the first step with `requiresConfirmation: true`
 * and returns preview data for that step without performing destructive side effects.
 */
export async function executePlan(
  plan: ActionPlan,
  context: PlanExecutionContext,
): Promise<ExecutePlanResult> {
  console.log("[EXECUTE PLAN]", plan);
  const stepResults: PlanCompletedResult["stepResults"] = [];

  for (const step of plan.plan) {
    if (step.requiresConfirmation) {
      console.log("[EXECUTE STEP]", step);
      const previewData = await confirmationPreview(step, context);
      logExecutionResult(previewData);
      return {
        type: "confirmation_required",
        step,
        previewData,
      };
    }

    const result = await executeStep(step, context);
    stepResults.push({ step, result });
  }

  return {
    type: "completed",
    stepResults,
  };
}
