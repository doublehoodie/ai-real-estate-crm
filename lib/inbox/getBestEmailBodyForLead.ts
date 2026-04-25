import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_LEN = 20;

type EmailRow = {
  thread_id: string | null;
  message_id: string | null;
  received_at: string;
  body: unknown;
  snippet: unknown;
};

function pickBody(row: EmailRow): string {
  const b = typeof row.body === "string" ? row.body.trim() : "";
  if (b.length > 0) return b;
  const s = typeof row.snippet === "string" ? row.snippet.trim() : "";
  return s;
}

/**
 * All emails for this lead, grouped by thread, messages ascending by date,
 * concatenated with separators (full thread text for AI, not a single snippet).
 */
export async function getAggregatedEmailThreadForLead(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("emails")
    .select("thread_id, message_id, received_at, body, snippet")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: true });

  if (error || !data?.length) {
    return null;
  }

  const byThread = new Map<string, EmailRow[]>();
  for (const row of data as EmailRow[]) {
    const tid =
      row.thread_id && String(row.thread_id).length > 0
        ? String(row.thread_id)
        : `__nothread__:${row.message_id ?? row.received_at}`;
    const list = byThread.get(tid);
    if (list) list.push(row);
    else byThread.set(tid, [row]);
  }

  const sortedThreadKeys = [...byThread.keys()].sort((a, b) => {
    const am = Math.min(...byThread.get(a)!.map((r) => new Date(r.received_at).getTime()));
    const bm = Math.min(...byThread.get(b)!.map((r) => new Date(r.received_at).getTime()));
    return am - bm;
  });

  const threadBlocks: string[] = [];
  for (const tid of sortedThreadKeys) {
    const msgs = [...byThread.get(tid)!].sort(
      (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
    );
    const parts = msgs.map(pickBody).filter((t) => t.length > 0);
    if (parts.length === 0) continue;
    threadBlocks.push(parts.join("\n\n---\n\n"));
  }

  const full = threadBlocks.join("\n\n========\n\n").trim();
  return full.length ? full : null;
}

/**
 * Merge DB thread text with caller hint (sync/API single message) without a second DB round-trip.
 */
export function buildResolvedEmailFromParts(
  threadCombined: string | null | undefined,
  hintFromCaller: string | null | undefined,
): string | null {
  const agg = (threadCombined ?? "").trim();
  const hint = (hintFromCaller ?? "").trim();

  if (agg.length >= MIN_LEN) return agg;
  if (hint.length >= MIN_LEN) return hint;
  if (agg.length > 0) return agg;
  if (hint.length > 0) return hint;
  return null;
}

/**
 * Prefer DB aggregated thread when strong enough; otherwise caller-provided body (e.g. sync/API).
 */
export async function resolveEmailBodyForAi(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  hintFromCaller: string | null | undefined,
): Promise<string | null> {
  const aggregated = await getAggregatedEmailThreadForLead(supabase, userId, leadId);
  return buildResolvedEmailFromParts(aggregated, hintFromCaller);
}

/**
 * Aggregated thread text for AI when long enough; otherwise null.
 */
export async function getBestEmailBodyForLead(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
): Promise<string | null> {
  const full = await getAggregatedEmailThreadForLead(supabase, userId, leadId);
  return full && full.length >= MIN_LEN ? full : null;
}
