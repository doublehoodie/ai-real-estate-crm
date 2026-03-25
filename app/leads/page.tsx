import { supabase } from "@/lib/supabase";
import type { Lead } from "@/types/lead";
import { Sidebar } from "@/components/Sidebar";
import { LeadTableFull } from "@/components/LeadTableFull";
import { resolveLeadScoring } from "@/lib/scoring";

export default async function LeadsPage() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("score", { ascending: false, nullsFirst: false });

  const leads = ((data ?? []).map((lead) => resolveLeadScoring(lead as Lead))) as Lead[];

  if (error) {
    console.error(error);
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
      <Sidebar active="leads" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 style={{ marginBottom: "8px", color: "#111" }}>Leads</h1>
        <p style={{ color: "#444", marginBottom: "24px" }}>
          Full lead list ranked by score, across all sources.
        </p>

        <LeadTableFull leads={leads} />
      </section>
    </main>
  );
}
