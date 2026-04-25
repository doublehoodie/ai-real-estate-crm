import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets `emails.lead_id` from `leads` when from/to address matches lead email and lead_id was null.
 * Does not call Gmail or modify sync behavior.
 */
export async function reconcileEmailsToLeads(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("reconcile_emails_to_leads", { p_user_id: userId });
  if (!error) {
    console.log("[reconcileEmailsToLeads] RPC ok", { userId });
  }
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    const missing =
      msg.includes("reconcile_emails_to_leads") &&
      (msg.includes("does not exist") || msg.includes("function"));
    if (missing) {
      console.warn("[reconcileEmailsToLeads] RPC missing; apply migration 20260416.");
      return;
    }
    console.error("[reconcileEmailsToLeads]", error);
  }
}
