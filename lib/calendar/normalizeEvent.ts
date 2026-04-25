import type { CalendarEventWithLead } from "@/types/calendar";

export type NormalizedCalendarEvent = CalendarEventWithLead & {
  notes: string;
};

export function normalizeEvent(event: CalendarEventWithLead): NormalizedCalendarEvent {
  return {
    ...event,
    notes: event.description ?? "",
  };
}

