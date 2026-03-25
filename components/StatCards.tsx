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
    <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
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
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "12px",
        padding: "18px",
        minWidth: "180px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: "14px", color: "#333", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: "#111" }}>{value}</div>
    </div>
  );
}
