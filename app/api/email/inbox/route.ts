import { NextResponse } from "next/server";
import { loadInboxThreadsForUser } from "@/lib/inbox/loadInboxFromDb";
import { reconcileEmailsToLeads } from "@/lib/inbox/reconcileEmailLeads";
import { runInboxAiCatchup } from "@/lib/inbox/runInboxAiCatchup";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";

/**
 * Read-only inbox: reconciles lead links, then loads threads from Supabase. Does not call Gmail.
 */
export async function GET() {
  try {
    const { supabase, userId } = await requireAuthUserId();
    console.log("user_id:", userId);

    await reconcileEmailsToLeads(supabase, userId);

    const { data: integration } = await supabase
      .from("user_integrations")
      .select("email")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .maybeSingle();

    const mailboxEmail = (integration?.email as string | undefined)?.trim() ?? "";

    let { threads } = await loadInboxThreadsForUser(supabase, userId);
    const catchup = await runInboxAiCatchup(supabase, userId, threads);
    threads = catchup.threads;

    return NextResponse.json({
      success: true,
      mailboxEmail,
      threads,
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to load inbox";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
