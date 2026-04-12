import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { Sidebar } from "@/components/Sidebar";
import { StatCards } from "@/components/StatCards";
import { LeadTable } from "@/components/LeadTable";
import { AddLeadForm } from "@/components/AddLeadForm";
import { resolveLeadScoring } from "@/lib/scoring";

export const dynamic = "force-dynamic";

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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    console.log("LEADS DATA (dashboard):", data);

    if (error) {
      console.error(error);
    } else {
      leads = ((data ?? []).map((lead) => resolveLeadScoring(lead as Lead))) as Lead[];
    }
  } else {
    console.log("LEADS DATA (dashboard, no user):", []);
  }

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
      }}
    >
      <Sidebar active="dashboard" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 style={{ marginBottom: "8px", color: "#111" }}>AI Real Estate CRM</h1>
        <p style={{ color: "#444", marginBottom: "24px" }}>Agent dashboard</p>

        <StatCards leads={leads} />

        <AddLeadForm />

        <LeadTable leads={leads} />
      </section>
    </main>
  );
}
