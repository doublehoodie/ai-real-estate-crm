export type CalendarEventType = "call" | "follow_up" | "tour" | "meeting";

export type CalendarEventUrgency = "low" | "medium" | "high";

export type CalendarEventStatus = "scheduled" | "completed" | "missed";

export type CalendarEventRow = {
  id: string;
  user_id: string;
  lead_id: string;
  type: CalendarEventType;
  title: string;
  description: string;
  location: string | null;
  start_time: string;
  end_time: string;
  urgency_level: CalendarEventUrgency;
  ai_generated: boolean;
  status: CalendarEventStatus;
  created_at: string;
};

export type CalendarEventWithLead = CalendarEventRow & {
  leads?: { name: string | null; email: string | null } | null;
};
