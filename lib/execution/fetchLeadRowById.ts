import type { Lead } from "@/types/lead";

/** Loads one lead row from the signed-in user's list (same source as the calendar). */
export async function fetchLeadRowById(leadId: string): Promise<Lead | null> {
  const res = await fetch("/api/leads", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { leads?: Lead[] };
  const row = (data.leads ?? []).find((l) => l.id === leadId);
  return row ?? null;
}
