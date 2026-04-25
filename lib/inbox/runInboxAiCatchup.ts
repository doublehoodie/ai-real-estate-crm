import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerAiIfNeeded } from "@/lib/ai/triggerAiIfNeeded";
import type { InboxThreadSummary } from "@/types/inbox";
import { loadInboxThreadsForUser } from "@/lib/inbox/loadInboxFromDb";
import { getBestEmailBodyForLead, resolveEmailBodyForAi } from "@/lib/inbox/getBestEmailBodyForLead";

const EMAIL_SCAN_MAX = 5;
const THREAD_FALLBACK_MAX = 5;

/**
 * After inbox threads are loaded: catch up AI for any linked leads that are still unprocessed
 * but have enough email text. Bounded per request; dedupes by lead id across phases.
 */
export async function runInboxAiCatchup(
  supabase: SupabaseClient,
  userId: string,
  threads: InboxThreadSummary[],
): Promise<{ threads: InboxThreadSummary[]; anyProcessed: boolean }> {
  const attempted = new Set<string>();
  let anyProcessed = false;

  const markProcessed = (result: Awaited<ReturnType<typeof triggerAiIfNeeded>>) => {
    if (result?.status === "processed") {
      anyProcessed = true;
    }
  };

  // Phase 1: any lead linked on recent emails (covers reconcileEmailsToLeads paths)
  const { data: emailRows, error: emailError } = await supabase
    .from("emails")
    .select("lead_id, body, snippet, received_at")
    .eq("user_id", userId)
    .not("lead_id", "is", null)
    .order("received_at", { ascending: false })
    .limit(400);

  if (emailError) {
    console.error("[inbox AI catchup] email scan failed:", emailError);
  } else {
    const bodyByLead = new Map<string, string>();
    for (const row of emailRows ?? []) {
      const lid = row.lead_id as string | null;
      if (!lid || bodyByLead.has(lid)) continue;
      const text =
        (typeof row.body === "string" ? row.body : "").trim() || (row.snippet ?? "").trim();
      if (text.length >= 20) {
        bodyByLead.set(lid, text);
      }
    }

    const candidateIds = [...bodyByLead.keys()];
    if (candidateIds.length > 0) {
      const { data: pendingLeads, error: leadsError } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId)
        .in("id", candidateIds);

      if (leadsError) {
        console.error("[inbox AI catchup] leads lookup failed:", leadsError);
      } else {
        let n = 0;
        for (const row of pendingLeads ?? []) {
          if (n >= EMAIL_SCAN_MAX) break;
          const leadId = row.id as string;
          if (attempted.has(leadId)) continue;
          const hint = bodyByLead.get(leadId) ?? "";
          const emailBody = await resolveEmailBodyForAi(supabase, userId, leadId, hint);
          if (!emailBody) continue;
          attempted.add(leadId);
          const result = await triggerAiIfNeeded(supabase, userId, leadId, emailBody, {
            reason: "post_reconcile_email_scan",
          });
          markProcessed(result);
          n += 1;
        }
      }
    }
  }

  // Phase 2: leads visible in current thread list (safety net)
  const fromThreads = new Set<string>();
  for (const t of threads) {
    if (t.lead?.id) {
      fromThreads.add(t.lead.id);
    }
  }

  let fb = 0;
  for (const leadId of [...fromThreads].sort()) {
    if (fb >= THREAD_FALLBACK_MAX) break;
    if (attempted.has(leadId)) continue;
    const emailBody = await getBestEmailBodyForLead(supabase, userId, leadId);
    if (!emailBody) continue;
    attempted.add(leadId);
    const result = await triggerAiIfNeeded(supabase, userId, leadId, emailBody, {
      reason: "inbox_thread_view_fallback",
    });
    markProcessed(result);
    fb += 1;
  }

  if (!anyProcessed) {
    return { threads, anyProcessed: false };
  }

  const { threads: refreshed } = await loadInboxThreadsForUser(supabase, userId);
  return { threads: refreshed, anyProcessed: true };
}
