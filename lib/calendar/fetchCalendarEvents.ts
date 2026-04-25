import type { CalendarEventWithLead } from "@/types/calendar";
import { normalizeEvent, type NormalizedCalendarEvent } from "@/lib/calendar/normalizeEvent";

export type FetchCalendarEventsParams = {
  from: Date;
  to: Date;
  leadId?: string | null;
};

/**
 * Browser: GET `/api/calendar/events` — same source of truth as server helper.
 */
export async function fetchCalendarEvents(params: FetchCalendarEventsParams): Promise<NormalizedCalendarEvent[]> {
  const qs = new URLSearchParams({
    from: params.from.toISOString(),
    to: params.to.toISOString(),
  });
  const leadId = params.leadId?.trim();
  if (leadId) qs.set("leadId", leadId);

  const res = await fetch(`/api/calendar/events?${qs}`, { credentials: "include" });
  const data = (await res.json()) as { error?: string; events?: CalendarEventWithLead[] };
  if (!res.ok) {
    throw new Error(data.error || "Failed to load events");
  }

  const raw = (data.events ?? []) as CalendarEventWithLead[];
  return raw.map((e) => normalizeEvent(e));
}
