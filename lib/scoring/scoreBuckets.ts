import type { Lead } from "@/types/lead";

export function getScoreBucketCounts(leads: Lead[]) {
  const hotLeads = leads.filter((l) => (l.ai_score ?? 0) >= 70);
  const warmLeads = leads.filter((l) => (l.ai_score ?? 0) >= 40 && (l.ai_score ?? 0) < 70);
  const coldLeads = leads.filter((l) => (l.ai_score ?? 0) < 40);
  return { hotLeads, warmLeads, coldLeads };
}
