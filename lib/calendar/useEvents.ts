"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCalendarEvents } from "@/lib/calendar/fetchCalendarEvents";
import type { NormalizedCalendarEvent } from "@/lib/calendar/normalizeEvent";
import { subscribeEventsRefresh } from "@/lib/calendar/eventsRefreshBus";

export type UseEventsOptions = {
  from: Date;
  to: Date;
  leadId?: string | null;
};

/**
 * Shared client hook: reads the same `/api/calendar/events` feed everywhere.
 * Subscribes to `refetchEvents()` so all surfaces stay aligned after mutations.
 */
export function useEvents(opts: UseEventsOptions) {
  const fromMs = opts.from.getTime();
  const toMs = opts.to.getTime();
  const leadKey = opts.leadId?.trim() ?? "";

  const [events, setEvents] = useState<NormalizedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeLabel = useMemo(
    () => ({ fromMs, toMs, leadId: leadKey || null }),
    [fromMs, toMs, leadKey],
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(rangeLabel.fromMs);
      const to = new Date(rangeLabel.toMs);
      const leadId = rangeLabel.leadId || undefined;
      const list = await fetchCalendarEvents({ from, to, leadId });
      setEvents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [rangeLabel]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    return subscribeEventsRefresh(() => {
      void refetch();
    });
  }, [refetch]);

  return { events, loading, error, refetch };
}
