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
      <main className="flex min-h-screen bg-[#f3f4f6]">
        <Sidebar active="leads" />
        <section style={{ flex: 1, padding: "32px" }}>
          <p className="text-red-700">You must be logged in to view leads.</p>
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
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="leads" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 text-gray-900">Leads</h1>
        <p className="mb-6 text-gray-500">Full lead list ranked by score, across all sources.</p>

        <LeadTableFull leads={leads} />
      </section>
    </main>
  );
}
