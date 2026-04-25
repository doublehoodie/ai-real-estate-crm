"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useEvents } from "@/lib/calendar/useEvents";
import { defaultLeadEventsRange } from "@/lib/calendar/defaultLeadEventsRange";

function formatWhen(isoStart: string): string {
  return new Date(isoStart).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeadEventsSection({ leadId }: { leadId: string }) {
  const { from, to } = useMemo(() => defaultLeadEventsRange(), []);
  const { events, loading, error } = useEvents({ from, to, leadId });

  const upcoming = useMemo(() => {
    const t = Date.now();
    return [...events]
      .filter((e) => new Date(e.end_time).getTime() >= t)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 12);
  }, [events]);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="m-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">Scheduled events</h2>
        <Link href="/calendar" className="text-sm font-medium text-green-400 hover:underline">
          Open calendar
        </Link>
      </div>
      {loading && <p className="m-0 text-sm text-slate-600 dark:text-slate-400">Loading events…</p>}
      {error && (
        <p className="m-0 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && upcoming.length === 0 && (
        <p className="m-0 text-sm text-slate-600 dark:text-slate-400">No upcoming events for this lead.</p>
      )}
      {!loading && !error && upcoming.length > 0 && (
        <ul className="m-0 list-none space-y-3 p-0">
          {upcoming.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
            >
              <div className="font-medium text-slate-900 dark:text-white">{e.title}</div>
              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{formatWhen(e.start_time)}</div>
              {e.location?.trim() ? (
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Location: {e.location.trim()}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
