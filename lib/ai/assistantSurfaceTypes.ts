/**
 * Client-visible assistant / Seed surface types (chat bubbles + action chips).
 */

export type AssistantExecutableAction = "draft_message" | "schedule_meeting" | "view_lead";

export type SeedActionType = "follow_up" | "schedule" | "view_lead" | "reengage";

export type SeedAction = {
  label: string;
  type: SeedActionType;
  leadId?: string;
};

export type AssistantStep = {
  label: string;
  action: AssistantExecutableAction;
};

export type AssistantActionRecommendation = {
  type: "action_recommendation";
  /** Target lead for all actions in this card */
  leadId: string;
  title: string;
  subtitle: string;
  description: string;
  steps: AssistantStep[];
  primaryAction: {
    label: string;
    action: AssistantExecutableAction;
  };
};

export type SeedStructuredResponse = {
  type: "seed_response";
  text: string;
  actions?: SeedAction[];
};

export type AssistantMessageContent = string | AssistantActionRecommendation | SeedStructuredResponse;

export type ExecuteActionPayload = {
  action: AssistantExecutableAction;
  leadId: string;
};
