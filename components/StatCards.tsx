import type { Lead } from "@/types/lead";
import { getScoreBucketCounts } from "@/lib/scoring/scoreBuckets";

type StatCardsProps = {
  leads: Lead[] | null;
};

export function StatCards({ leads }: StatCardsProps) {
  const allLeads = leads ?? [];
  const totalLeads = allLeads.length;
  const { hotLeads, warmLeads, coldLeads } = getScoreBucketCounts(allLeads);
  console.log("HOT LEADS:", hotLeads.length);
  console.log("SCORE BUCKET COUNTS", {
    hot: hotLeads.length,
    warm: warmLeads.length,
    cold: coldLeads.length,
  });
  const newLeads = allLeads.filter((lead) => (lead.status ?? "New") === "New").length;
  const averageScore = getAverageScore(allLeads);

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <StatCard title="Total Leads" value={String(totalLeads)} />
      <StatCard title="Hot Leads" value={String(hotLeads.length)} />
      <StatCard title="New Leads" value={String(newLeads)} />
      <StatCard title="Avg. Score" value={averageScore} />
    </div>
  );
}

function getAverageScore(leads: Lead[]) {
  const scoredLeads = leads.filter((lead) => typeof lead.ai_score === "number" && Number.isFinite(lead.ai_score));

  if (scoredLeads.length === 0) {
    return "—";
  }

  const total = scoredLeads.reduce((sum, lead) => sum + (lead.ai_score ?? 0), 0);
  return Math.round(total / scoredLeads.length).toString();
}

type StatCardProps = {
  title: string;
  value: string;
};

function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="min-w-[180px] rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur transition-all duration-200 ease-out hover:scale-[1.01]">
      <div className="mb-2 text-sm text-slate-600 dark:text-slate-400">{title}</div>
      <div className="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
