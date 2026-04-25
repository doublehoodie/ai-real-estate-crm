import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEventWithLead } from "@/types/calendar";
import { normalizeEvent, type NormalizedCalendarEvent } from "@/lib/calendar/normalizeEvent";

export type GetEventsForUserRange = { from: Date; to: Date };

export type GetEventsForUserOptions = {
  leadId?: string;
};

/**
 * Server-side: load overlapping `calendar_events` for a user and normalize.
 * Same overlap rule as GET /api/calendar/events: event intersects [from, to).
 */
export async function getEventsForUser(
  supabase: SupabaseClient,
  userId: string,
  range: GetEventsForUserRange,
  options?: GetEventsForUserOptions,
): Promise<NormalizedCalendarEvent[]> {
  let q = supabase
    .from("calendar_events")
    .select("*, leads(name, email)")
    .eq("user_id", userId)
    .lt("start_time", range.to.toISOString())
    .gt("end_time", range.from.toISOString())
    .order("start_time", { ascending: true });

  if (options?.leadId) {
    q = q.eq("lead_id", options.leadId);
  }

  const { data, error } = await q;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CalendarEventWithLead[];
  return rows.map((e) => normalizeEvent(e));
}
