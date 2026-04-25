/**
 * Client-visible assistant / Seed surface types (chat bubbles + action chips).
 */

export type AssistantExecutableAction = "draft_message" | "schedule_meeting" | "view_lead";

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

export type AssistantMessageContent = string | AssistantActionRecommendation;

export type ExecuteActionPayload = {
  action: AssistantExecutableAction;
  leadId: string;
};
