import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { ActionLandingClient } from "@/components/action/ActionLandingClient";

export const dynamic = "force-dynamic";

const ACTION_LEADS_SELECT = "id, name, email, ai_score, ai_next_action, status, last_contact_at, updated_at";

type Row = {
  id: string;
  name?: string | null;
  email?: string | null;
  ai_score?: number | null;
  ai_next_action?: { priority?: string } | null;
  status?: string | null;
  last_contact_at?: string | null;
  updated_at?: string | null;
};

function countAttention(leads: Row[]): number {
  return leads.filter((l) => {
    const na = l.ai_next_action;
    if (na && typeof na === "object" && na.priority === "high") return true;
    return (l.ai_score ?? 0) >= 72;
  }).length;
}

export default async function ActionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[action] getUser:", authError);
  }

  let attentionCount = 0;
  let displayName = "there";
  let leadsCount = 0;
  let gmailConnected = false;
  let hasHotLead = false;
  let readyForMeeting = false;

  if (user) {
    const meta = user.user_metadata as { full_name?: string } | undefined;
    displayName = meta?.full_name?.trim() || user.email?.split("@")[0] || displayName;

    const { data, error } = await supabase
      .from("leads")
      .select(ACTION_LEADS_SELECT)
      .eq("user_id", user.id);

    if (error) {
      console.error("[action] leads:", error);
    } else {
      const leads = (data ?? []) as Row[];
      leadsCount = leads.length;
      attentionCount = countAttention(leads);
      hasHotLead = leads.some((lead) => (lead.ai_score ?? 0) >= 70);
      readyForMeeting = leads.some((lead) => {
        const status = (lead.status ?? "").toLowerCase();
        return (lead.ai_score ?? 0) >= 70 && (status === "engaged" || status === "qualified");
      });
    }

    const { data: integration } = await supabase
      .from("user_integrations")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle();
    gmailConnected = Boolean(integration?.id);
  }

  return (
    <main className="flex min-h-screen bg-zinc-950">
      <Sidebar active="action" />
      <ActionLandingClient
        displayName={displayName}
        attentionCount={attentionCount}
        leadsCount={leadsCount}
        gmailConnected={gmailConnected}
        hasHotLead={hasHotLead}
        readyForMeeting={readyForMeeting}
      />
    </main>
  );
}
