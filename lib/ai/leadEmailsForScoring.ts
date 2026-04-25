import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadEmailForScoring = {
  received_at: string;
  text: string;
};

function pickBody(body: unknown, snippet: unknown): string {
  const b = typeof body === "string" ? body.trim() : "";
  if (b.length > 0) return b;
  return typeof snippet === "string" ? snippet.trim() : "";
}

/**
 * Emails for this lead, oldest first, with non-empty text (body preferred over snippet).
 */
export async function fetchLeadEmailsForScoring(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
): Promise<LeadEmailForScoring[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("received_at, body, snippet")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: true });

  if (error) {
    console.warn("[leadEmailsForScoring]", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => ({
      received_at: row.received_at as string,
      text: pickBody(row.body, row.snippet),
    }))
    .filter((row) => row.text.trim().length > 0);
}
