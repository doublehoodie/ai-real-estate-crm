"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarEventType, CalendarEventUrgency } from "@/types/calendar";
import { inputFieldClass, primaryButton, secondaryButton } from "@/lib/ui";
import { buildCleanEventNotes } from "@/lib/calendar/buildCleanEventNotes";
import { refetchEvents } from "@/lib/calendar/eventsRefreshBus";

const TYPE_LABELS: Record<CalendarEventType, string> = {
  call: "Call",
  follow_up: "Follow-up",
  tour: "Tour",
  meeting: "Meeting",
};

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartEnd(): { start: string; end: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) };
}

type ScheduleLeadEventModalProps = {
  /** `inline` = embedded on a route (no full-screen overlay). */
  mode?: "modal" | "inline";
  open: boolean;
  leadId: string;
  leadName: string;
  /** Pre-filled concise note suggestion (human-readable). */
  suggestedNotes?: string;
  /** Seed / calendar route: default event type when form resets. */
  initialEventType?: CalendarEventType;
  /** When set (e.g. from Seed calendar flow), overrides generated title. */
  defaultTitle?: string;
  defaultStartLocal?: string;
  defaultEndLocal?: string;
  defaultDescription?: string;
  onClose: () => void;
  onCreated?: () => void;
};

export function ScheduleLeadEventModal({
  mode = "modal",
  open,
  leadId,
  leadName,
  suggestedNotes = "",
  initialEventType = "follow_up",
  defaultTitle,
  defaultStartLocal,
  defaultEndLocal,
  defaultDescription,
  onClose,
  onCreated,
}: ScheduleLeadEventModalProps) {
  const [type, setType] = useState<CalendarEventType>(initialEventType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<"Google Meet" | "Zoom" | "Phone Call" | "In Person">(
    "Google Meet",
  );
  const [address, setAddress] = useState("");
  const [urgency, setUrgency] = useState<CalendarEventUrgency>("medium");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedSuggestion = useMemo(() => suggestedNotes.trim(), [suggestedNotes]);

  const active = mode === "inline" || open;

  useEffect(() => {
    if (!active) return;
    setError(null);
    setType(initialEventType);
    const { start, end } =
      defaultStartLocal && defaultEndLocal
        ? { start: defaultStartLocal, end: defaultEndLocal }
        : defaultStartEnd();
    setStartLocal(start);
    setEndLocal(end);
    setUrgency("medium");
    const name = leadName.trim() || "Lead";
    if (defaultTitle?.trim()) {
      setTitle(defaultTitle.trim());
    } else {
      setTitle(`${TYPE_LABELS[initialEventType]} · ${name}`);
    }
    if (defaultDescription != null && defaultDescription.trim()) {
      setDescription(buildCleanEventNotes(defaultDescription));
    } else {
      setDescription(buildCleanEventNotes(trimmedSuggestion));
    }
    setLocationType("Google Meet");
    setAddress("");
  }, [
    active,
    leadName,
    trimmedSuggestion,
    initialEventType,
    defaultTitle,
    defaultStartLocal,
    defaultEndLocal,
    defaultDescription,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    setSaving(true);
    setError(null);
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Invalid date or time.");
      setSaving(false);
      return;
    }
    if (end < start) {
      setError("End time must be after start.");
      setSaving(false);
      return;
    }
    const desc = buildCleanEventNotes(description);
    const location =
      locationType === "In Person"
        ? address.trim()
          ? `In Person — ${address.trim()}`
          : "In Person"
        : locationType === "Google Meet"
          ? "Virtual (Google Meet)"
          : locationType;
    const aiGenerated = Boolean(trimmedSuggestion && desc === trimmedSuggestion);

    try {
      const payload = {
        leadId,
        type,
        title: title.trim(),
        description: desc,
        location,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        urgencyLevel: urgency,
        aiGenerated,
      };
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save event");
        return;
      }
      onCreated?.();
      refetchEvents("create");
      onClose();
    } catch {
      setError("Could not save event");
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Event type</label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as CalendarEventType;
            setType(t);
            const name = leadName.trim() || "Lead";
            setTitle(`${TYPE_LABELS[t]} · ${name}`);
          }}
          className={inputFieldClass}
        >
          {(Object.keys(TYPE_LABELS) as CalendarEventType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputFieldClass}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Start</label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className={inputFieldClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">End</label>
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className={inputFieldClass}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Location</label>
        <select
          value={locationType}
          onChange={(e) =>
            setLocationType(e.target.value as "Google Meet" | "Zoom" | "Phone Call" | "In Person")
          }
          className={inputFieldClass}
        >
          <option value="Google Meet">Google Meet</option>
          <option value="Zoom">Zoom</option>
          <option value="Phone Call">Phone Call</option>
          <option value="In Person">In Person</option>
        </select>
      </div>

      {locationType === "In Person" ? (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputFieldClass}
            placeholder="Enter location address"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Urgency</label>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as CalendarEventUrgency)}
          className={inputFieldClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Notes (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Add context for this touchpoint."
          className={inputFieldClass}
        />
        {trimmedSuggestion ? (
          <p className="mt-1 text-xs text-gray-500">Suggested note is pre-filled; edit anytime.</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={secondaryButton} onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );

  const innerCard = (
    <div
      className={`w-full max-w-md rounded-xl border p-6 shadow-lg ${
        mode === "inline" ? "border-white/10 bg-zinc-900/80" : "border-gray-200 bg-white"
      }`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h2 id="schedule-lead-event-title" className={`m-0 text-lg font-semibold ${mode === "inline" ? "text-zinc-100" : "text-gray-900"}`}>
        {mode === "inline" ? "New event" : "Schedule with lead"}
      </h2>
      <p className={`mt-1 text-sm ${mode === "inline" ? "text-zinc-400" : "text-gray-500"}`}>
        {leadName.trim() || "Lead"} — saved to your CRM calendar.
      </p>
      {form}
    </div>
  );

  if (mode === "inline") {
    return innerCard;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-lead-event-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      {innerCard}
    </div>
  );
}
