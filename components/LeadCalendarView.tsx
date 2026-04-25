"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CalendarEventWithLead } from "@/types/calendar";
import { useEvents } from "@/lib/calendar/useEvents";
import { refetchEvents } from "@/lib/calendar/eventsRefreshBus";
import { toDateInputValue } from "@/lib/calendar/localDateInputs";
import { useCalendarViewStore } from "@/lib/stores/calendarViewStore";

const CALENDAR_ROWS = 6;
const CELLS = CALENDAR_ROWS * 7;

/** Full-day timeline for debug visibility */
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const PX_PER_MINUTE = 1;
const DAY_TIMELINE_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MINUTE;
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekSunday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

/** Sun–Sat week containing `date`. */
function getWeekFromDate(date: Date): Date[] {
  const start = startOfWeekSunday(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function monthRange(d: Date): { from: Date; to: Date } {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { from, to };
}

function getFetchRange(
  anchor: Date,
  viewMode: "month" | "week" | "day",
  selectedDate: Date | null,
): { from: Date; to: Date; label: string } {
  if (viewMode === "day") {
    const d = selectedDate ?? anchor;
    const from = startOfDay(d);
    const to = addDays(from, 1);
    return {
      from,
      to,
      label: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  }
  if (viewMode === "month") {
    const { from, to } = monthRange(anchor);
    return {
      from,
      to,
      label: anchor.toLocaleString(undefined, { month: "long", year: "numeric" }),
    };
  }
  const from = startOfWeekSunday(anchor);
  const to = addDays(from, 7);
  const endDay = addDays(from, 6);
  return {
    from,
    to,
    label: `${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endDay.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
  };
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

const weekdayShortSunStart = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MonthCell = { kind: "empty" } | { kind: "day"; date: Date };

/** Exactly 42 cells (6×7) for stable row indices. */
function buildMonthGrid42(anchor: Date): MonthCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ kind: "empty" });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ kind: "day", date: new Date(year, month, d) });
  }
  while (cells.length < CELLS) {
    cells.push({ kind: "empty" });
  }
  return cells.slice(0, CELLS);
}

function findCellIndexForDay(cells: MonthCell[], day: Date): number {
  const t = startOfDay(day).getTime();
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.kind === "day" && startOfDay(c.date).getTime() === t) return i;
  }
  return 0;
}

function getEventTimeParts(dateString: string): { hours: number; minutes: number } {
  const d = new Date(dateString);
  return {
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toTimeInputValue(dateString: string): string {
  const d = new Date(dateString);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function withTimeOnSameDay(baseIso: string, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  const d = new Date(baseIso);
  d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d.toISOString();
}

function displayTypeLabel(type: string): string {
  if (type === "follow_up") return "Follow-up";
  return type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseLocationUi(location: string | null | undefined): {
  mode: "Virtual (Google Meet)" | "Zoom" | "Phone Call" | "In Person";
  details: string;
} {
  const raw = (location ?? "").trim();
  if (!raw || raw === "Virtual (Google Meet)") return { mode: "Virtual (Google Meet)", details: "" };
  if (raw.startsWith("Virtual (Google Meet)")) {
    return { mode: "Virtual (Google Meet)", details: raw.replace(/^Virtual \(Google Meet\)\s*[-—]?\s*/i, "").trim() };
  }
  if (raw.startsWith("Zoom")) return { mode: "Zoom", details: raw.replace(/^Zoom\s*[-—]?\s*/i, "").trim() };
  if (raw.startsWith("Phone Call")) {
    return { mode: "Phone Call", details: raw.replace(/^Phone Call\s*[-—]?\s*/i, "").trim() };
  }
  if (raw.startsWith("In Person")) {
    const details = raw.replace(/^In Person\s*[-—]?\s*/i, "").trim();
    return { mode: "In Person", details };
  }
  return { mode: "In Person", details: raw };
}

function composeLocation(mode: "Virtual (Google Meet)" | "Zoom" | "Phone Call" | "In Person", details: string): string {
  const d = details.trim();
  if (mode === "In Person") {
    return d ? `In Person — ${d}` : "In Person";
  }
  return d ? `${mode} — ${d}` : mode;
}

function DayTimeline({
  day,
  events,
  onSelectEvent,
}: {
  day: Date;
  events: CalendarEventWithLead[];
  onSelectEvent: (event: CalendarEventWithLead) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    return events
      .filter((e) => sameLocalDay(new Date(e.start_time), day))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events, day]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = 9 * 60;
  }, [day, list.length]);

  const hasEarlyEvents = useMemo(
    () => list.some((e) => getEventTimeParts(e.start_time).hours < 9),
    [list],
  );
  const hasLateEvents = useMemo(
    () => list.some((e) => getEventTimeParts(e.start_time).hours > 21),
    [list],
  );

  return (
    <div className="relative w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-sans text-sm text-slate-900 dark:text-white">
      {hasEarlyEvents ? (
        <div className="pointer-events-none absolute top-0 z-10 w-full py-1 text-center text-sm text-green-500">
          ↑ Earlier events
        </div>
      ) : null}
      {hasLateEvents ? (
        <div className="pointer-events-none absolute bottom-0 z-10 w-full py-1 text-center text-sm text-green-500">
          ↓ Later events
        </div>
      ) : null}

      <div ref={containerRef} className="relative h-[720px] overflow-y-auto">
        <div className="relative h-[1440px]">
          {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i).map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-slate-200 dark:border-neutral-800 text-xs text-slate-500 dark:text-slate-400"
              style={{ top: `${(hour - DAY_START_HOUR) * 60}px` }}
            >
              <span className="absolute left-0 top-0 pl-2 pt-0.5">{hour}:00</span>
            </div>
          ))}
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-neutral-800" />

          <div className="absolute inset-0 pl-14 pr-2 pt-0">
            {list.length === 0 ? (
              <p className="absolute left-14 right-4 top-4 text-sm text-slate-500 dark:text-slate-400">No events this day.</p>
            ) : null}
            {list.map((e) => {
              const { hours, minutes } = getEventTimeParts(e.start_time);
              const { hours: endH, minutes: endM } = getEventTimeParts(e.end_time);
              const startMinutes = hours * 60 + minutes;
              const endMinutes = endH * 60 + endM;
              const top = startMinutes;
              const height = Math.max(endMinutes - startMinutes, 30);

              if (top < 0 || top > 1440) {
                console.warn("[EVENT OUTSIDE RANGE]", e);
              }

              return (
                <div
                  key={e.id}
                  onClick={() => onSelectEvent(e)}
                  className="absolute left-2 right-2 cursor-pointer overflow-hidden rounded-md bg-green-500 px-2 py-1 text-left text-xs font-medium text-white shadow-sm transition hover:opacity-90"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                  }}
                  title={e.title}
                >
                  <span className="line-clamp-2">{e.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const WEEK_CELL_FIXED_H = 112;

export function LeadCalendarView() {
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithLead | null>(null);
  const [savingTime, setSavingTime] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<"Virtual (Google Meet)" | "Zoom" | "Phone Call" | "In Person">(
    "Virtual (Google Meet)",
  );
  const [locationDetails, setLocationDetails] = useState("");
  const calendarSurfaceRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const monthForGrid = useMemo(
    () => new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    [anchor],
  );

  const grid42 = useMemo(() => buildMonthGrid42(monthForGrid), [monthForGrid]);

  const activeWeekRow = useMemo(() => {
    if (viewMode !== "week") return null;
    const refDay = selectedDate ?? anchor;
    const monthY = monthForGrid.getFullYear();
    const monthM = monthForGrid.getMonth();
    const weekDays = getWeekFromDate(refDay);
    const dayInThisMonth = weekDays.find((d) => d.getFullYear() === monthY && d.getMonth() === monthM);
    const lookupDay = dayInThisMonth ?? refDay;
    const idx = findCellIndexForDay(grid42, lookupDay);
    return Math.floor(idx / 7);
  }, [viewMode, selectedDate, anchor, grid42, monthForGrid]);

  const { from: fromR, to: toR, label: labelR } = useMemo(
    () => getFetchRange(anchor, viewMode, selectedDate),
    [anchor, viewMode, selectedDate],
  );

  const { events, loading, error } = useEvents({ from: fromR, to: toR });

  const storeSelectedDay = useCalendarViewStore((s) => s.selectedDate);
  const lastAppliedStoreDay = useRef<string | null>(null);

  useEffect(() => {
    if (!storeSelectedDay) {
      lastAppliedStoreDay.current = null;
      return;
    }
    if (lastAppliedStoreDay.current === storeSelectedDay) return;
    lastAppliedStoreDay.current = storeSelectedDay;
    const parts = storeSelectedDay.split("-").map((x) => Number(x));
    const [y, m, d] = parts;
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return;
    const day = new Date(y, m - 1, d);
    if (Number.isNaN(day.getTime())) return;
    setAnchor(day);
    setSelectedDate(day);
    setViewMode("day");
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-calendar-focus-day="${storeSelectedDay}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [storeSelectedDay]);

  useEffect(() => {
    setSelectedEvent((prev) => {
      if (!prev) return prev;
      const next = events.find((e) => e.id === prev.id);
      return next ?? null;
    });
  }, [events]);

  useEffect(() => {
    if (!selectedEvent) return;
    console.log("[EVENT MODAL DATA]", selectedEvent);
    const parsed = parseLocationUi(selectedEvent.location);
    setLocationMode(parsed.mode);
    setLocationDetails(parsed.details);
  }, [selectedEvent]);

  useEffect(() => {
    if (viewMode !== "week") return;

    function handlePointerDown(event: MouseEvent) {
      const el = calendarSurfaceRef.current;
      if (!el) return;
      const target = event.target as Node;
      if (el.contains(target)) return;
      setViewMode("month");
      setSelectedDate(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [viewMode]);

  function goPrev() {
    if (viewMode === "week") setSelectedDate(null);
    if (viewMode === "day") {
      const base = selectedDate ?? anchor;
      const next = addDays(base, -1);
      setSelectedDate(next);
      setAnchor(next);
      return;
    }
    setAnchor((d) => {
      const x = new Date(d);
      if (viewMode === "month") {
        x.setMonth(x.getMonth() - 1);
        return x;
      }
      return addDays(startOfWeekSunday(x), -7);
    });
  }

  function goNext() {
    if (viewMode === "week") setSelectedDate(null);
    if (viewMode === "day") {
      const base = selectedDate ?? anchor;
      const next = addDays(base, 1);
      setSelectedDate(next);
      setAnchor(next);
      return;
    }
    setAnchor((d) => {
      const x = new Date(d);
      if (viewMode === "month") {
        x.setMonth(x.getMonth() + 1);
        return x;
      }
      return addDays(startOfWeekSunday(x), 7);
    });
  }

  function goToday() {
    const n = new Date();
    setAnchor(n);
    if (viewMode === "day") {
      setSelectedDate(n);
    } else {
      setViewMode("month");
      setSelectedDate(null);
    }
  }

  function handleMonthDayClick(day: Date) {
    setSelectedDate(day);
    setAnchor(startOfWeekSunday(day));
    setViewMode("week");
  }

  function handleWeekDayClick(day: Date) {
    setSelectedDate(day);
    setAnchor(day);
    setViewMode("day");
  }

  function backToMonth() {
    setViewMode("month");
    setSelectedDate(null);
  }

  function backToWeek() {
    setViewMode("week");
  }

  async function persistEventTime(event: CalendarEventWithLead, nextStartIso: string, nextEndIso: string) {
    setSavingTime(true);
    setTimeError(null);
    try {
      const payload = { start_time: nextStartIso, end_time: nextEndIso };
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; event?: CalendarEventWithLead };
      if (!res.ok || !data.event) {
        setTimeError(data.error || "Failed to update time");
        return;
      }
      refetchEvents("update");
    } catch {
      setTimeError("Failed to update time");
    } finally {
      setSavingTime(false);
    }
  }

  async function handleChangeEventTime(which: "start" | "end", value: string) {
    if (!selectedEvent) return;
    const nextStartIso =
      which === "start" ? withTimeOnSameDay(selectedEvent.start_time, value) : selectedEvent.start_time;
    const nextEndIso =
      which === "end" ? withTimeOnSameDay(selectedEvent.end_time, value) : selectedEvent.end_time;
    await persistEventTime(selectedEvent, nextStartIso, nextEndIso);
  }

  async function handleChangeEventLocation(
    mode: "Virtual (Google Meet)" | "Zoom" | "Phone Call" | "In Person",
    details: string,
  ) {
    if (!selectedEvent) return;
    const location = composeLocation(mode, details);
    setTimeError(null);
    const payload = { location };
    const res = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; event?: CalendarEventWithLead };
    if (!res.ok || !data.event) {
      setTimeError(data.error || "Failed to update location");
      return;
    }
    refetchEvents("update");
  }

  async function handleDeleteEvent() {
    if (!selectedEvent) return;
    const eventId = selectedEvent.id;
    const res = await fetch(`/api/calendar/events/${eventId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setTimeError("Failed to delete event");
      return;
    }
    setSelectedEvent(null);
    refetchEvents("delete");
  }

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div ref={calendarSurfaceRef} className="space-y-4">
      <div
        className={`flex flex-wrap items-center gap-3 ${viewMode === "week" || viewMode === "day" ? "justify-between" : "justify-end"}`}
      >
        <div className="min-h-[28px] min-w-[3rem]">
          {viewMode === "day" ? (
            <button
              type="button"
              onClick={backToWeek}
              className="rounded p-0 text-xs font-medium text-slate-700 dark:text-white underline-offset-2 hover:text-slate-900 dark:hover:text-slate-200 hover:underline"
            >
              Back
            </button>
          ) : viewMode === "week" ? (
            <button
              type="button"
              onClick={backToMonth}
              className="rounded p-0 text-xs font-medium text-slate-700 dark:text-white underline-offset-2 hover:text-slate-900 dark:hover:text-slate-200 hover:underline"
            >
              Back
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/20"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/20"
          >
            →
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            Today
          </button>
        </div>
      </div>

      {viewMode === "week" || viewMode === "month" ? (
        viewMode === "week" ? (
          <button
            type="button"
            onClick={backToMonth}
            className="block w-full border-0 bg-transparent p-0 text-left text-base font-semibold text-slate-900 dark:text-white hover:opacity-80"
          >
            {labelR}
          </button>
        ) : (
          <div className="text-base font-semibold text-slate-900 dark:text-white">{labelR}</div>
        )
      ) : (
        <div className="text-base font-semibold text-slate-900 dark:text-white">{labelR}</div>
      )}

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading events…</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && (
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          {viewMode === "day" ? (
            <div
              className="rounded-2xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 shadow-sm backdrop-blur"
              data-calendar-focus-day={toDateInputValue(selectedDate ?? anchor)}
            >
              <DayTimeline day={selectedDate ?? anchor} events={events} onSelectEvent={setSelectedEvent} />
            </div>
          ) : (
            <motion.div
              layout
              initial={false}
              animate={{
                scale: viewMode === "week" ? 1.03 : 1,
              }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              style={{ transformOrigin: "center top" }}
            >
              <motion.div layout className="rounded-2xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 shadow-sm backdrop-blur">
                <div className="mb-3 grid grid-cols-7 gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>

                <motion.div
                  layout
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="flex flex-col gap-2"
                  style={{
                    minHeight: viewMode === "week" ? undefined : 0,
                  }}
                >
                  {Array.from({ length: CALENDAR_ROWS }, (_, row) => {
                    const rowHidden =
                      viewMode === "week" && activeWeekRow !== null && row !== activeWeekRow;
                    const cells = grid42.slice(row * 7, row * 7 + 7);

                    return (
                      <motion.div
                        layout
                        key={`row-${row}`}
                        className="grid grid-cols-7 gap-2"
                        style={{
                          gridTemplateRows:
                            viewMode === "week" && !rowHidden ? `${WEEK_CELL_FIXED_H}px` : undefined,
                          opacity: rowHidden ? 0 : 1,
                          height: rowHidden ? 0 : "auto",
                          minHeight: rowHidden ? 0 : undefined,
                          overflow: rowHidden ? "hidden" : "visible",
                          pointerEvents: rowHidden ? "none" : "auto",
                          visibility: rowHidden ? "hidden" : "visible",
                        }}
                        aria-hidden={rowHidden}
                      >
                        {cells.map((cell, col) => {
                          const globalIndex = row * 7 + col;
                          if (cell.kind === "empty") {
                            return (
                              <div
                                key={`empty-${globalIndex}`}
                                style={rowHidden ? { minHeight: 0, padding: 0 } : { minHeight: viewMode === "month" ? "52px" : 0 }}
                              />
                            );
                          }
                          const date = cell.date;
                          const isToday =
                            date.getDate() === today.getDate() &&
                            date.getMonth() === today.getMonth() &&
                            date.getFullYear() === today.getFullYear();
                          const isActiveWeekRow = viewMode === "week" && activeWeekRow === row;
                          const dayEvents = events
                            .filter((e) => sameLocalDay(new Date(e.start_time), date))
                            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
                          const indicatorCount = Math.min(dayEvents.length, 3);

                          return (
                            <motion.div
                              layout
                              key={date.toISOString()}
                              className="min-w-0"
                              style={{
                                minHeight: viewMode === "month" ? "52px" : isActiveWeekRow ? WEEK_CELL_FIXED_H : 0,
                              }}
                            >
                              {viewMode === "month" || !isActiveWeekRow ? (
                                <motion.button
                                  layout
                                  type="button"
                                  data-calendar-focus-day={toDateInputValue(date)}
                                  whileTap={{ scale: 1.04 }}
                                  transition={{ duration: 0.35, ease: "easeInOut" }}
                                  onClick={() => handleMonthDayClick(date)}
                                  className={`flex w-full flex-col items-center gap-1 rounded-xl border py-2.5 ${
                                    isToday
                                      ? "border-[#1AB523]/40 bg-emerald-50/50"
                                      : "border-transparent bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800"
                                  } ${viewMode === "week" && !isActiveWeekRow ? "opacity-0" : ""}`}
                                  style={{
                                    minHeight: "52px",
                                    boxSizing: "border-box",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">{date.getDate()}</span>
                                  {dayEvents.length > 0 ? (
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1AB523]"
                                      aria-label="Events scheduled"
                                    />
                                  ) : (
                                    <span className="h-1.5 w-1.5 shrink-0" aria-hidden />
                                  )}
                                </motion.button>
                              ) : (
                                <button
                                  type="button"
                                  data-calendar-focus-day={toDateInputValue(date)}
                                  onClick={() => handleWeekDayClick(date)}
                                  className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-2 py-2 text-center shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 ${
                                    selectedDate && sameLocalDay(date, selectedDate)
                                      ? "bg-green-100 border-green-500 ring-1 ring-[#1AB523]/35 ring-offset-2"
                                      : ""
                                  }`}
                                  style={{
                                    height: WEEK_CELL_FIXED_H,
                                    minHeight: WEEK_CELL_FIXED_H,
                                    maxHeight: WEEK_CELL_FIXED_H,
                                    boxSizing: "border-box",
                                  }}
                                >
                                  <div className="shrink-0">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      {weekdayShortSunStart[date.getDay()]}
                                    </div>
                                    <div className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{date.getDate()}</div>
                                  </div>
                                  <div className="mt-1 flex min-h-0 w-full flex-1 flex-col justify-start gap-1 overflow-hidden">
                                    {Array.from({ length: indicatorCount }, (_, i) => (
                                      <div
                                        key={i}
                                        className="h-2 w-full shrink-0 rounded-sm bg-green-500"
                                        aria-hidden
                                      />
                                    ))}
                                  </div>
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}

      {!loading && events.length === 0 && !error && viewMode !== "day" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No events in this range. Schedule from a lead or the inbox.</p>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[420px] rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedEvent.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-md px-2 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
                aria-label="Close event details"
              >
                x
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <div>
                <strong>Time:</strong>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={toTimeInputValue(selectedEvent.start_time)}
                    onChange={(e) => void handleChangeEventTime("start", e.target.value)}
                    className="rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-slate-900 dark:text-white"
                    disabled={savingTime}
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={toTimeInputValue(selectedEvent.end_time)}
                    onChange={(e) => void handleChangeEventTime("end", e.target.value)}
                    className="rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-slate-900 dark:text-white"
                    disabled={savingTime}
                  />
                </div>
              </div>
              <div>
                <strong>Lead:</strong> {selectedEvent.leads?.name || selectedEvent.leads?.email || "—"}
              </div>
              <div>
                <strong>Type:</strong> {displayTypeLabel(selectedEvent.type)}
              </div>
              <div>
                <strong>Location:</strong> {selectedEvent.location?.trim() || "—"}
                <div className="mt-1 space-y-2">
                  <select
                    value={locationMode}
                    onChange={(e) => {
                      const mode = e.target.value as "Virtual (Google Meet)" | "Zoom" | "Phone Call" | "In Person";
                      setLocationMode(mode);
                      void handleChangeEventLocation(mode, locationDetails);
                    }}
                    className="w-full rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                    disabled={savingTime}
                  >
                    <option value="Virtual (Google Meet)">Virtual (Google Meet)</option>
                    <option value="Zoom">Zoom</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="In Person">In Person</option>
                  </select>
                  {locationMode === "In Person" ? (
                    <input
                      type="text"
                      value={locationDetails}
                      onChange={(e) => setLocationDetails(e.target.value)}
                      onBlur={() => void handleChangeEventLocation(locationMode, locationDetails)}
                      className="w-full rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                      placeholder="Address or location details"
                      disabled={savingTime}
                    />
                  ) : (
                    <input
                      type="text"
                      value={locationDetails}
                      onChange={(e) => setLocationDetails(e.target.value)}
                      onBlur={() => {
                        if (locationDetails.trim()) {
                          void handleChangeEventLocation(locationMode, locationDetails);
                        }
                      }}
                      className="w-full rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                      placeholder="Optional link/details"
                      disabled={savingTime}
                    />
                  )}
                </div>
              </div>
              <div>
                <strong>Notes:</strong> {selectedEvent.description?.trim() || "—"}
              </div>
              {timeError ? <div className="text-sm text-red-600">{timeError}</div> : null}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteEvent()}
                className="rounded bg-red-500 px-3 py-1 text-sm text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
