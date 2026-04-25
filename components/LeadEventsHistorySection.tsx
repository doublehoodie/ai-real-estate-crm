"use client";

import { useMemo } from "react";
import { useEvents } from "@/lib/calendar/useEvents";

function formatWhenRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

function toEventTypeLabel(type: string): string {
  if (type === "follow_up") return "Follow-up";
  return type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeadEventsHistorySection({ leadId }: { leadId: string }) {
  const range = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear() - 5, 0, 1),
      to: now,
    };
  }, []);

  const { events, loading, error } = useEvents({
    from: range.from,
    to: range.to,
    leadId,
  });

  const past = useMemo(() => {
    const t = Date.now();
    return [...events]
      .filter((e) => new Date(e.end_time).getTime() < t)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [events]);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
      <h2 className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">Event history</h2>
      <p className="mb-4 mt-0 text-sm text-slate-600 dark:text-slate-400">Past meetings and touchpoints for this lead.</p>

      {loading && <p className="m-0 text-sm text-slate-600 dark:text-slate-400">Loading history…</p>}
      {error ? (
        <p className="m-0 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && past.length === 0 ? (
        <p className="m-0 text-sm text-slate-600 dark:text-slate-400">No past events yet for this lead.</p>
      ) : null}

      {!loading && !error && past.length > 0 ? (
        <ul className="m-0 list-none space-y-3 p-0">
          {past.map((e) => (
            <li key={e.id} className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white">{e.title}</span>
                <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {toEventTypeLabel(e.type)}
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">{e.status}</span>
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{formatWhenRange(e.start_time, e.end_time)}</div>
              {e.location?.trim() ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Location: {e.location.trim()}</div> : null}
              {e.notes?.trim() ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Notes: {e.notes.trim()}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
