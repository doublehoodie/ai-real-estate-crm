"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, X } from "lucide-react";
import { buildCleanEventNotes } from "@/lib/calendar/buildCleanEventNotes";
import { combineLocalDateAndTime, toDateInputValue, toTimeInputValue } from "@/lib/calendar/localDateInputs";
import { refetchEvents } from "@/lib/calendar/eventsRefreshBus";
import { getUpcomingWeekdaySlots } from "@/lib/calendar/suggestedMeetingSlots";
import { inputFieldClass, primaryButton, secondaryButton } from "@/lib/ui";
import { appendAssistantSessionLine } from "@/lib/stores/assistantSessionStore";
import {
  closeFloatingCalendarEditor,
  getCalendarEditorState,
  setCalendarDraftEvent,
  setCalendarEditorMinimized,
  setCalendarEditorOpen,
  setCalendarEditorPosition,
  useCalendarEditorStore,
} from "@/lib/stores/calendarEditorStore";
import { setCalendarViewSelectedDate } from "@/lib/stores/calendarViewStore";

type CalendarDragSession = { startX: number; startY: number; initialX: number; initialY: number };

export function FloatingCalendarEditor() {
  const isOpen = useCalendarEditorStore((s) => s.isOpen);
  const lead = useCalendarEditorStore((s) => s.lead);
  const draftEvent = useCalendarEditorStore((s) => s.draftEvent);
  const isMinimized = useCalendarEditorStore((s) => s.isMinimized);
  const position = useCalendarEditorStore((s) => s.position);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<CalendarDragSession | null>(null);

  const slots = useRef(getUpcomingWeekdaySlots(3)).current;

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const { x, y } = getCalendarEditorState().position;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: x,
      initialY: y,
    };
  }, []);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session) return;
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    setCalendarEditorPosition({
      x: session.initialX + dx,
      y: session.initialY + dy,
    });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (!lead) return null;

  const leadName = lead.name?.trim() || lead.email?.trim() || "Lead";

  async function handleSave() {
    const L = lead;
    if (!L) return;
    setError(null);
    const start = combineLocalDateAndTime(draftEvent.date, draftEvent.time);
    if (Number.isNaN(start.getTime())) {
      setError("Pick a valid date and time.");
      return;
    }
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const trimmedNotes = draftEvent.notes.trim();
    const descLines: string[] = [];
    if (trimmedNotes) descLines.push(trimmedNotes);
    if (L.ai_summary?.trim()) descLines.push(`AI context: ${L.ai_summary.trim()}`);
    descLines.push(`Lead: ${leadName}`);
    const description = buildCleanEventNotes(descLines.join("\n\n"));
    const trimmedSuggestion = buildCleanEventNotes(trimmedNotes);
    const aiGenerated = Boolean(trimmedSuggestion && description === trimmedSuggestion);

    setSaving(true);
    try {
      const payload = {
        leadId: L.id,
        type: "meeting" as const,
        title: `Meeting with ${leadName}`,
        description,
        location: "Virtual (Google Meet)",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        urgencyLevel: "medium" as const,
        aiGenerated,
      };

      const res = await fetch("/api/calendar/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not save event");
      }

      const patchRes = await fetch(`/api/leads/${L.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "meeting_scheduled" }),
      });
      const patchData = (await patchRes.json().catch(() => ({}))) as { error?: string };
      if (!patchRes.ok) {
        throw new Error(patchData.error || "Event saved but lead status could not be updated.");
      }

      refetchEvents("create");
      setCalendarViewSelectedDate(toDateInputValue(start));
      appendAssistantSessionLine("Meeting scheduled.\nNext step: send confirmation.");
      closeFloatingCalendarEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[119]">
      <div
        className="pointer-events-auto absolute w-[min(100vw-24px,380px)] rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        style={{
          left: 24,
          bottom: 24,
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        role="dialog"
        aria-label="Schedule meeting"
      >
        <div
          className="flex cursor-grab select-none items-center justify-between gap-2 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 px-3 py-2 active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Schedule meeting</p>
            <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">{leadName}</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isMinimized ? (
              <button
                type="button"
                title="Restore"
                aria-label="Restore"
                onClick={() => setCalendarEditorMinimized(false)}
                className="rounded-md border border-slate-200 dark:border-neutral-800 p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                title="Minimize"
                aria-label="Minimize"
                onClick={() => setCalendarEditorMinimized(true)}
                className="rounded-md border border-slate-200 dark:border-neutral-800 p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={() => setCalendarEditorOpen(false)}
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="rounded-full border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  onClick={() =>
                    setCalendarDraftEvent({
                      date: toDateInputValue(s.start),
                      time: toTimeInputValue(s.start),
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Date
              <input
                type="date"
                value={draftEvent.date ?? ""}
                onChange={(e) => setCalendarDraftEvent({ date: e.target.value || null })}
                className={`${inputFieldClass} mt-1`}
              />
            </label>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Time
              <input
                type="time"
                value={draftEvent.time ?? ""}
                onChange={(e) => setCalendarDraftEvent({ time: e.target.value || null })}
                className={`${inputFieldClass} mt-1`}
              />
            </label>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Notes (optional)
              <textarea
                value={draftEvent.notes}
                onChange={(e) => setCalendarDraftEvent({ notes: e.target.value })}
                rows={3}
                className={`${inputFieldClass} mt-1 resize-y`}
              />
            </label>

            {error && <p className="text-xs text-red-300">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => closeFloatingCalendarEditor()}
                className={`rounded-lg px-3 py-2 text-sm ${secondaryButton}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className={`rounded-lg px-3 py-2 text-sm ${primaryButton}`}
              >
                {saving ? "Saving…" : "Save event"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
