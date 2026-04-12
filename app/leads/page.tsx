import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { Sidebar } from "@/components/Sidebar";
import { LeadTableFull } from "@/components/LeadTableFull";
import { resolveLeadScoring } from "@/lib/scoring";

export const dynamic = "force-dynamic";

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
          <p style={{ color: "#b91c1c" }}>You must be logged in to view leads.</p>
        </section>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  console.log("LEADS DATA:", data);

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
