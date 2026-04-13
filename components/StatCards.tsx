import type { Lead } from "@/types/lead";

type StatCardsProps = {
  leads: Lead[] | null;
};

export function StatCards({ leads }: StatCardsProps) {
  const allLeads = leads ?? [];
  const totalLeads = allLeads.length;
  const hotLeads = allLeads.filter((lead) => lead.status === "Hot").length;
  const newLeads = allLeads.filter((lead) => (lead.status ?? "New") === "New").length;
  const averageScore = getAverageScore(allLeads);

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <StatCard title="Total Leads" value={String(totalLeads)} />
      <StatCard title="Hot Leads" value={String(hotLeads)} />
      <StatCard title="New Leads" value={String(newLeads)} />
      <StatCard title="Avg. Score" value={averageScore} />
    </div>
  );
}

function getAverageScore(leads: Lead[]) {
  const scoredLeads = leads.filter((lead) => typeof lead.score === "number");

  if (scoredLeads.length === 0) {
    return "—";
  }

  const total = scoredLeads.reduce((sum, lead) => sum + (lead.score ?? 0), 0);
  return Math.round(total / scoredLeads.length).toString();
}

type StatCardProps = {
  title: string;
  value: string;
};

function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="min-w-[180px] rounded-xl border border-gray-200 bg-white p-[18px] shadow-sm">
      <div className="mb-2 text-sm text-gray-500">{title}</div>
      <div className="text-[28px] font-bold text-gray-900">{value}</div>
    </div>
  );
}
