import type { LucideIcon } from "lucide-react";
import { CalendarDays, Inbox, ListChecks, Upload, UserPlus } from "lucide-react";

export type ActionContext = {
  leadsCount: number;
  gmailConnected: boolean;
  hasHotLead: boolean;
  readyForMeeting: boolean;
};

export type ActionId = "import_csv" | "connect_gmail" | "add_lead" | "follow_up" | "schedule_meeting";
export type ActionHandler = () => void | Promise<void>;

export type ActionConfig = {
  id: ActionId;
  label: string;
  description: string;
  icon: LucideIcon;
  priority: number;
  condition: (ctx: ActionContext) => boolean;
  seedPrompt: string;
};

export type ResolvedActionConfig = ActionConfig & { handler: ActionHandler };

export const ACTION_CONFIG: ActionConfig[] = [
  {
    id: "import_csv",
    label: "Import Leads",
    description: "Upload a CSV to start your pipeline.",
    icon: Upload,
    priority: 100,
    condition: (ctx) => ctx.leadsCount === 0,
    seedPrompt: "You don’t have any leads yet. Let’s start by importing them.",
  },
  {
    id: "follow_up",
    label: "Follow Up",
    description: "Open a draft for your hottest lead.",
    icon: ListChecks,
    priority: 95,
    condition: (ctx) => ctx.hasHotLead,
    seedPrompt: "This lead is ready for a follow-up.",
  },
  {
    id: "connect_gmail",
    label: "Connect Gmail",
    description: "Sync inbox threads and responses.",
    icon: Inbox,
    priority: 90,
    condition: (ctx) => !ctx.gmailConnected,
    seedPrompt: "Connect Gmail so Seed can track replies and timing.",
  },
  {
    id: "schedule_meeting",
    label: "Schedule Meeting",
    description: "Book time with a ready lead.",
    icon: CalendarDays,
    priority: 90,
    condition: (ctx) => ctx.readyForMeeting,
    seedPrompt: "This lead is ready for a meeting.",
  },
  {
    id: "add_lead",
    label: "Add Lead",
    description: "Create your first lead manually.",
    icon: UserPlus,
    priority: 80,
    condition: (ctx) => ctx.leadsCount === 0,
    seedPrompt: "Add your first lead to unlock Seed workflows.",
  },
];

export function resolveVisibleActions(ctx: ActionContext): ActionConfig[] {
  return ACTION_CONFIG.filter((action) => action.condition(ctx))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

export function buildActionPlan(
  ctx: ActionContext,
  handlers: Record<ActionId, ActionHandler>,
): ResolvedActionConfig[] {
  return resolveVisibleActions(ctx).map((action) => ({
    ...action,
    handler: handlers[action.id],
  }));
}
