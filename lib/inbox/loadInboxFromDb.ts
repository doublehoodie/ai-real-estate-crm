import type { SupabaseClient } from "@supabase/supabase-js";
import { groupEmailsIntoThreads } from "@/lib/inbox";
import { isUuid } from "@/lib/ids";
import type { InboxEmailRow, InboxThreadMeta, InboxThreadNote, InboxThreadSummary } from "@/types/inbox";

type DBEmailRow = {
  user_id: string;
  thread_id: string | null;
  subject: string;
  from_email: string | null;
  to_email: string | null;
  snippet: string;
  received_at: string;
  direction?: string | null;
  lead_id: string | null;
  message_id: string | null;
  provider: string | null;
};

function mergeOrphanLeadNotes(
  threads: InboxThreadSummary[],
  orphanByLead: Map<string, InboxThreadNote[]>,
): InboxThreadSummary[] {
  return threads.map((t) => {
    const extra = t.lead?.id ? orphanByLead.get(t.lead.id) ?? [] : [];
    if (extra.length === 0) return t;
    const merged = [...t.notes, ...extra];
    const seen = new Set<string>();
    const deduped = merged.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    deduped.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { ...t, notes: deduped };
  });
}

/**
 * Loads inbox thread summaries from Supabase only (no Gmail). Uses auth user_id for all queries.
 */
export async function loadInboxThreadsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ threads: InboxThreadSummary[]; emailRowCount: number }> {
  let emailRows: DBEmailRow[] | null = null;
  const primarySelect = await supabase
    .from("emails")
    .select("user_id,thread_id,subject,from_email,to_email,snippet,received_at,direction,lead_id,message_id,provider")
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(400);

  if (primarySelect.error) {
    const msg = primarySelect.error.message?.toLowerCase() ?? "";
    const directionMissing = msg.includes("direction") && msg.includes("column");
    if (!directionMissing) {
      console.error("[loadInboxFromDb] emails select:", primarySelect.error);
      throw new Error(primarySelect.error.message);
    }

    console.warn("[loadInboxFromDb] emails.direction missing; legacy select.");
    const legacySelect = await supabase
      .from("emails")
      .select("user_id,thread_id,subject,from_email,to_email,snippet,received_at,lead_id,message_id,provider")
      .eq("user_id", userId)
      .order("received_at", { ascending: false })
      .limit(400);

    if (legacySelect.error) {
      console.error(legacySelect.error);
      throw new Error(legacySelect.error.message);
    }
    emailRows = (legacySelect.data as DBEmailRow[] | null) ?? [];
  } else {
    emailRows = (primarySelect.data as DBEmailRow[] | null) ?? [];
  }

  console.log("[loadInboxFromDb] Fetched emails from DB:", emailRows.length);

  const rows = emailRows ?? [];
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))].filter(isUuid);

  const leadMap = new Map<string, { id: string; name: string | null; email: string | null }>();
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, email")
      .in("id", leadIds);

    if (leadsError) {
      console.error(leadsError);
    } else {
      for (const l of leads ?? []) {
        leadMap.set(l.id, l);
      }
    }
  }

  const enriched: InboxEmailRow[] = rows.map((r) => {
    const leadId = r.lead_id && isUuid(r.lead_id) ? r.lead_id : null;
    return {
      message_id: r.message_id,
      thread_id: r.thread_id,
      from_email: r.from_email,
      to_email: r.to_email,
      subject: r.subject,
      snippet: r.snippet,
      received_at: r.received_at,
      lead_id: leadId,
      provider: r.provider ?? "gmail",
      direction: (r.direction as InboxEmailRow["direction"]) ?? null,
      lead: leadId ? leadMap.get(leadId) ?? null : null,
    };
  });

  const { data: metaRows } = await supabase
    .from("inbox_thread_meta")
    .select("thread_id, is_favorite, needs_action")
    .eq("user_id", userId);

  const metaByThread = new Map<string, InboxThreadMeta>();
  for (const m of metaRows ?? []) {
    metaByThread.set(m.thread_id, {
      thread_id: m.thread_id,
      is_favorite: Boolean(m.is_favorite),
      needs_action: Boolean(m.needs_action),
    });
  }

  const { data: noteRows, error: notesError } = await supabase
    .from("notes")
    .select("id, thread_id, lead_id, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(800);

  if (notesError) {
    console.error("[loadInboxFromDb] notes select:", notesError);
    throw new Error(notesError.message);
  }

  const notesByThread = new Map<string, InboxThreadNote[]>();
  const orphanByLead = new Map<string, InboxThreadNote[]>();

  for (const n of noteRows ?? []) {
    const entry: InboxThreadNote = {
      id: n.id,
      thread_id: n.thread_id,
      lead_id: n.lead_id,
      note: n.content,
      created_at: n.created_at,
    };
    if (n.thread_id) {
      const list = notesByThread.get(n.thread_id) ?? [];
      list.push(entry);
      notesByThread.set(n.thread_id, list);
    }
    if (!n.thread_id && n.lead_id) {
      const list = orphanByLead.get(n.lead_id) ?? [];
      list.push(entry);
      orphanByLead.set(n.lead_id, list);
    }
  }

  let threads = groupEmailsIntoThreads(enriched, metaByThread, notesByThread);
  threads = mergeOrphanLeadNotes(threads, orphanByLead);

  console.log("[loadInboxFromDb] Threads built:", threads.length);

  return { threads, emailRowCount: rows.length };
}
