/**
 * Manual smoke test for executePlan (no network).
 * Run: npm run execute-plan-smoke
 */

import { executePlan } from "../lib/ai/executePlan";
import type { ActionPlan } from "../lib/ai/actionPlanTypes";
import type { PlanExecutionContext } from "../lib/ai/planExecutionTypes";

const mockPlan: ActionPlan = {
  intent: "follow_up",
  message: "Recommended next step: Follow up — test.",
  plan: [{ action: "draft_message", requiresConfirmation: true, ui: "Draft" }],
};

const mockContext: PlanExecutionContext = {
  lead: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test Lead",
    email: "test@example.com",
    phone: null,
    budget: null,
    timeline: null,
    status: "active",
    notes: null,
    ai_followup: "Hi — checking in on next steps.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

void (async () => {
  const result = await executePlan(mockPlan, mockContext);
  console.log("[SMOKE DONE]", result);
})();
