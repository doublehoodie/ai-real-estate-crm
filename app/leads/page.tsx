import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { AppLayout } from "@/components/layout/AppLayout";
import { LeadTableFull } from "@/components/LeadTableFull";
import { resolveLeadScoring } from "@/lib/scoring";
import { normalizeLeadCoreFields } from "@/lib/leadNormalization";

export const dynamic = "force-dynamic";
const LEADS_PAGE_SELECT =
  "id, user_id, name, email, phone, budget, budget_value, timeline, status, notes, " +
  "ai_summary, ai_intent_level, ai_score, " +
  "ai_score_breakdown, ai_confidence, ai_signals, ai_next_action, ai_followup, has_contradictions, " +
  "ai_processed, ai_last_processed_at, is_favorite, created_at, updated_at";

export default async function LeadsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Leads page getUser:", authError);
  }

  if (!user?.id) {
    console.log("LEADS DATA (no user):", []);
    return (
      <AppLayout active="leads" title="Leads" description="Full lead list ranked by score, across all sources.">
        <p className="text-sm text-red-300">You must be logged in to view leads.</p>
      </AppLayout>
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .select(LEADS_PAGE_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  console.log("[SELECT STRING]", LEADS_PAGE_SELECT);
  console.log("[RAW LEADS FROM DB]", data);

  // Keep explicit select as primary path; fall back only when schema drift causes missing-column select failures.
  let rawLeads = (data ?? []) as unknown[];
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    const isColumnSelectIssue = msg.includes("column") && (msg.includes("does not exist") || msg.includes("schema cache"));
    if (isColumnSelectIssue) {
      console.warn("[LEADS SELECT FALLBACK]", error.message);
      const fallback = await supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (!fallback.error) {
        rawLeads = (fallback.data ?? []) as unknown[];
      }
    }
  }

  const normalized = rawLeads.map((lead) => normalizeLeadCoreFields(lead as Lead));
  console.log("[NORMALIZED LEADS]", normalized);
  console.log("[BEFORE SCORING]", normalized);
  const scored = normalized.map((lead) => resolveLeadScoring(lead as Lead));
  console.log("[AFTER SCORING]", scored);
  const leads = scored as Lead[];
  console.log("[LEAD TABLE DATA]", leads);

  if (error) {
    console.error(error);
  }

  return (
    <AppLayout active="leads" title="Leads" description="Full lead list ranked by score, across all sources.">
      <LeadTableFull leads={leads} />
    </AppLayout>
  );
}
