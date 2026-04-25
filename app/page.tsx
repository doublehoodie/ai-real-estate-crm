import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCards } from "@/components/StatCards";
import { LeadTable } from "@/components/LeadTable";
import { AddLeadForm } from "@/components/AddLeadForm";
import { resolveLeadScoring } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const DASHBOARD_LEADS_SELECT =
  "id, name, email, phone, budget, timeline, status, notes, created_at, " +
  "ai_score, ai_score_breakdown, ai_confidence, ai_summary, ai_followup, " +
  "ai_processed, ai_intent_level, ai_signals, ai_next_action, has_contradictions, is_favorite";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[dashboard] getUser:", authError);
  }

  console.log("[dashboard] session user id:", user?.id ?? "none");

  let leads: Lead[] = [];
  if (user?.id) {
    const { data, error } = await supabase
      .from("leads")
      .select(DASHBOARD_LEADS_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    console.log("LEADS DATA (dashboard):", data);

    if (error) {
      console.error(error);
    } else {
      leads = ((data ?? []).map((lead) => resolveLeadScoring(lead as unknown as Lead))) as Lead[];
    }
  } else {
    console.log("LEADS DATA (dashboard, no user):", []);
  }

  return (
    <AppLayout active="dashboard" title="Dashboard" description="Agent dashboard">
      <StatCards leads={leads} />
      <AddLeadForm />
      <LeadTable leads={leads} />
    </AppLayout>
  );
}
