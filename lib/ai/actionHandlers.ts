import type { PlanExecutionContext } from "@/lib/ai/planExecutionTypes";
import type { CalendarEventType, CalendarEventUrgency } from "@/types/calendar";

function resolveApiUrl(path: string, origin?: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (origin) return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  return path;
}

function defaultEmailSubject(lead: PlanExecutionContext["lead"]): string {
  const name = lead.name?.trim() || "Lead";
  return `Following up — ${name}`;
}

function buildDraftPreview(lead: PlanExecutionContext["lead"]): string {
  const ai = lead.ai_followup?.trim();
  if (ai) return ai;
  const first = lead.name?.split(" ")[0]?.trim() || "there";
  return `Hi ${first},\n\nFollowing up on our last conversation. Let me know what works best for a quick call this week.\n\nThanks`;
}

/** Deterministic “free” labels from the current instant (no AI). */
function deterministicSuggestedTimes(): string[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const friday = new Date(now);
  const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7;
  friday.setDate(friday.getDate() + daysUntilFriday);
  friday.setHours(11, 0, 0, 0);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  };
  return [tomorrow.toLocaleString(undefined, opts), friday.toLocaleString(undefined, opts)];
}

export async function draft_message(
  context: PlanExecutionContext,
): Promise<{ preview: string }> {
  const preview = buildDraftPreview(context.lead);
  return { preview };
}

export async function send_message(
  context: PlanExecutionContext,
): Promise<{ success: boolean; error?: string }> {
  const to = context.lead.email?.trim();
  const body = context.messageDraft?.trim() || context.lead.ai_followup?.trim() || "";
  if (!to || !body) {
    return { success: false, error: "Missing lead email or message body (run draft_message first or set ai_followup)." };
  }
  if (!context.fetchApi) {
    return { success: false, error: "fetchApi is required to send email." };
  }
  const subject = context.emailSubject?.trim() || defaultEmailSubject(context.lead);
  const url = resolveApiUrl("/api/email/send", context.origin);
  const res = await context.fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ to, subject, body }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { success: false, error: err.error || `Send failed (${res.status})` };
  }
  return { success: true };
}

/**
 * Reads calendar events for the next 7 days and returns two suggested labels.
 * If the API is unavailable, falls back to deterministic time strings.
 */
export async function suggest_time(
  context: PlanExecutionContext,
): Promise<{ suggestedTimes: string[] }> {
  const leadId = context.lead.id;
  const from = new Date();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (!context.fetchApi || !leadId) {
    return { suggestedTimes: deterministicSuggestedTimes() };
  }

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    leadId,
  });
  const url = resolveApiUrl(`/api/calendar/events?${params}`, context.origin);
  try {
    const res = await context.fetchApi(url, { credentials: "include" });
    if (!res.ok) {
      return { suggestedTimes: deterministicSuggestedTimes() };
    }
    const data = (await res.json()) as { events?: { start_time: string }[] };
    const busy = (data.events ?? []).length;
    const base = deterministicSuggestedTimes();
    if (busy === 0) return { suggestedTimes: base };
    return {
      suggestedTimes: [`${base[0]} (lighter week — ${busy} existing event(s) on file)`, base[1]],
    };
  } catch {
    return { suggestedTimes: deterministicSuggestedTimes() };
  }
}

type CreateEventPayload = {
  leadId: string;
  type: CalendarEventType;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  urgencyLevel: CalendarEventUrgency;
  aiGenerated?: boolean;
};

export async function create_event(
  context: PlanExecutionContext,
): Promise<{ success: boolean; error?: string }> {
  const leadId = context.lead.id;
  if (!leadId || !context.fetchApi) {
    return { success: false, error: "fetchApi and lead.id are required to create an event." };
  }
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 24);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  const name = context.lead.name?.trim() || "Lead";
  const payload: CreateEventPayload = {
    leadId,
    type: "follow_up",
    title: `Follow-up · ${name}`,
    description: context.lead.ai_summary?.trim() || undefined,
    location: "Virtual (Google Meet)",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    urgencyLevel: "medium",
    aiGenerated: true,
  };
  const url = resolveApiUrl("/api/calendar/events", context.origin);
  const res = await context.fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { success: false, error: err.error || `Create event failed (${res.status})` };
  }
  return { success: true };
}

export async function update_notes(
  context: PlanExecutionContext,
): Promise<{ success: boolean; error?: string }> {
  const leadId = context.lead.id;
  if (!leadId || !context.fetchApi) {
    return { success: false, error: "fetchApi and lead.id are required to update notes." };
  }
  const stamp = new Date().toISOString();
  const line = `[CRM Assistant ${stamp}] Quick note from assistant execution.`;
  const prev = context.lead.notes?.trim() ?? "";
  const note = prev ? `${prev}\n${line}` : line;
  const url = resolveApiUrl("/api/inbox/lead-profile-note", context.origin);
  const res = await context.fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ leadId, note }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { success: false, error: err.error || `Notes update failed (${res.status})` };
  }
  return { success: true };
}

export async function view_details(
  context: PlanExecutionContext,
): Promise<{ navigateTo: string }> {
  return { navigateTo: `/leads/${context.lead.id}` };
}
