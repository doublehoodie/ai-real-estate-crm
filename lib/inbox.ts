import type { InboxEmailRow, InboxThreadMeta, InboxThreadNote, InboxThreadSummary } from "@/types/inbox";

/**
 * When a Gmail thread has multiple messages, they may reference different `lead_id`s over time.
 * Prefer showing AI from a lead that actually has AI data; otherwise use the newest linked lead.
 */
export function pickLeadForThread(messages: InboxEmailRow[]): InboxThreadSummary["lead"] {
  const sorted = [...messages].sort(
    (x, y) => new Date(y.received_at).getTime() - new Date(x.received_at).getTime(),
  );
  const candidates: NonNullable<InboxEmailRow["lead"]>[] = [];
  const seen = new Set<string>();
  for (const m of sorted) {
    if (m.lead_id && m.lead && !seen.has(m.lead.id)) {
      seen.add(m.lead.id);
      candidates.push(m.lead);
    }
  }
  if (candidates.length === 0) return null;
  const preferred = candidates.find(
    (l) =>
      l.ai_processed === true ||
      (typeof l.ai_summary === "string" && l.ai_summary.trim().length > 0),
  );
  return preferred ?? candidates[0];
}

/**
 * Groups flat email rows by Gmail thread_id and computes summary fields for the UI.
 */
export function groupEmailsIntoThreads(
  rows: InboxEmailRow[],
  metaByThread: Map<string, InboxThreadMeta>,
  notesByThread: Map<string, InboxThreadNote[]>,
): InboxThreadSummary[] {
  const byThread = new Map<string, InboxEmailRow[]>();

  for (const row of rows) {
    const tid = row.thread_id ?? row.message_id ?? "unknown";
    const list = byThread.get(tid);
    if (list) list.push(row);
    else byThread.set(tid, [row]);
  }

  const summaries: InboxThreadSummary[] = [];

  for (const [thread_id, messages] of byThread) {
    const sorted = [...messages].sort(
      (x, y) => new Date(y.received_at).getTime() - new Date(x.received_at).getTime(),
    );
    const latest = sorted[0];
    const subject =
      sorted.reduce((best, m) => (m.subject && m.subject !== "(No subject)" ? m.subject : best), latest.subject) ||
      "(No subject)";

    const lead = pickLeadForThread(sorted);

    const hasUnlinkedInbound = sorted.some(
      (m) => m.direction === "inbound" && !m.lead_id,
    );

    const meta = metaByThread.get(thread_id);
    const is_favorite = meta?.is_favorite ?? false;
    const needs_action = meta ? meta.needs_action : hasUnlinkedInbound;
    const needs_attention = hasUnlinkedInbound || Boolean(meta?.needs_action);

    summaries.push({
      thread_id,
      subject,
      latest_snippet: latest.snippet || "",
      latest_at: latest.received_at,
      message_count: sorted.length,
      lead,
      needs_attention,
      is_favorite,
      needs_action,
      notes: notesByThread.get(thread_id) ?? [],
      messages: sorted,
    });
  }

  summaries.sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime());

  return summaries;
}

/**
 * Picks the external party's address for "Add as lead" from thread messages.
 */
export function pickContactEmailForLead(
  userEmail: string,
  messages: InboxEmailRow[],
): { email: string; name: string | null } | null {
  const me = userEmail.trim().toLowerCase();

  const sorted = [...messages].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
  );

  for (const m of sorted) {
    if (m.direction === "inbound" && m.from_email) {
      const addr = m.from_email.trim().toLowerCase();
      if (addr && addr !== me) {
        return { email: m.from_email.trim(), name: null };
      }
    }
  }

  for (const m of sorted) {
    if (m.direction === "outbound" && m.to_email) {
      const addr = m.to_email.trim().toLowerCase();
      if (addr && addr !== me) {
        return { email: m.to_email.trim(), name: null };
      }
    }
  }

  return null;
}

export function pickReplyTarget(
  userEmail: string,
  messages: InboxEmailRow[],
): { to: string; subject: string } | null {
  const normalizedUser = userEmail.trim().toLowerCase();
  const sorted = [...messages].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
  );
  const last = sorted[sorted.length - 1];
  if (!last) return null;

  const from = last.from_email?.toLowerCase() ?? "";
  const to = last.to_email?.toLowerCase() ?? "";

  if (last.direction === "inbound") {
    const addr = last.from_email;
    if (addr) return { to: addr, subject: last.subject || "(No subject)" };
  }
  if (last.direction === "outbound" && to && to !== normalizedUser) {
    return { to: last.to_email!, subject: last.subject || "(No subject)" };
  }
  const other = [from, to].find((e) => e && e !== normalizedUser);
  if (other) {
    const raw = last.from_email?.toLowerCase() === other ? last.from_email! : last.to_email!;
    return { to: raw, subject: last.subject || "(No subject)" };
  }
  return null;
}

/** Subject line for a reply: `Re: …` without duplicating an existing `Re:` prefix. */
export function buildReplySubject(threadSubject: string): string {
  const t = threadSubject.replace(/\s+/g, " ").trim() || "(No subject)";
  if (/^re:\s*/i.test(t)) return t;
  return `Re: ${t}`;
}
