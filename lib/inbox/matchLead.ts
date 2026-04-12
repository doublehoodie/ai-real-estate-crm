import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/ids";

export async function matchLeadIdForAddresses(
  supabase: SupabaseClient,
  userId: string,
  fromEmail: string | null,
  toEmail: string | null,
): Promise<string | null> {
  const addresses = [...new Set([fromEmail, toEmail].filter(Boolean) as string[])];
  if (addresses.length === 0) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .in("email", addresses)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Lead match error:", error);
    return null;
  }

  const id = data?.id ?? null;
  return id && isUuid(id) ? id : null;
}
