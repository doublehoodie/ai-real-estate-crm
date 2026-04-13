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
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="dashboard" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 bg-gradient-to-r from-[#1AB523] to-black bg-clip-text text-4xl font-semibold tracking-tight text-transparent transition-all duration-500 hover:bg-[linear-gradient(to_right,#1AB523_40%,black_100%)]">
          Welcome!
        </h1>
        <p className="mb-6 text-gray-500">Agent dashboard</p>

        <StatCards leads={leads} />

        <AddLeadForm />

        <LeadTable leads={leads} />
      </section>
    </main>
  );
}
