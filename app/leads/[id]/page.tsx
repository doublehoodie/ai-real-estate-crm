import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { Sidebar } from "@/components/Sidebar";
import { displayBudgetText, formatBudgetValueUsd } from "@/lib/format";
import { resolveLeadScoring } from "@/lib/scoring";
import { LeadScoreBadge } from "@/components/LeadScoreBadge";
import { LeadScoreDetails } from "@/components/LeadScoreDetails";
import { EditLeadForm } from "@/components/EditLeadForm";
import { LeadDetailFavorite } from "@/components/LeadDetailFavorite";

type LeadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(error);
    notFound();
  }

  const lead = resolveLeadScoring(data as Lead);

  const { data: inboxNotes } = await supabase
    .from("notes")
    .select("id, thread_id, content, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
      }}
    >
      <Sidebar active="leads" />

      <section style={{ flex: 1, padding: "32px" }}>
        <div style={{ marginBottom: "16px" }}>
          <Link
            href="/leads"
            style={{
              display: "inline-flex",
              padding: "6px 12px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              background: "white",
              fontSize: "13px",
            }}
          >
            ← Back to leads
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "4px",
          }}
        >
          <LeadDetailFavorite leadId={lead.id} initialFavorite={lead.is_favorite === true} />
          <h1 style={{ margin: 0, color: "#111" }}>{lead.name || "Untitled lead"}</h1>
        </div>
        <p style={{ marginTop: 0, marginBottom: "24px", color: "#6b7280", fontSize: "14px" }}>
          Lead details and activity overview
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
            gap: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "16px", color: "#111" }}>
              Contact information
            </h2>

            <DetailRow label="Name" value={lead.name} />
            <DetailRow label="Email" value={lead.email} />
            <DetailRow label="Phone" value={lead.phone} />
          </div>

          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "16px", color: "#111" }}>
              Buying profile
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "8px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Budget</span>
              <div style={{ textAlign: "right", maxWidth: "65%" }}>
                <span style={{ fontSize: "14px", color: "#111", fontWeight: 500, whiteSpace: "pre-wrap" }}>
                  {displayBudgetText(lead.budget)}
                </span>
                {lead.budget_value != null && (
                  <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                    Parsed estimate: {formatBudgetValueUsd(lead.budget_value)}
                  </div>
                )}
              </div>
            </div>
            <DetailRow label="Timeline" value={lead.timeline} />
            <DetailRow label="Status" value={lead.status} />
            <DetailRow
              label="Created"
              value={lead.created_at ? new Date(lead.created_at).toLocaleString() : null}
            />
            <div style={{ paddingTop: "16px" }}>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Lead score</div>
              <LeadScoreBadge
                score={lead.score}
                confidenceScore={lead.score_breakdown?.dataConfidence}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px", color: "#111" }}>
            Scoring breakdown
          </h2>
          <LeadScoreDetails
            breakdown={lead.score_breakdown}
            explanation={lead.score_explanation}
          />
        </div>

        <div
          style={{
            marginTop: "20px",
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px", color: "#111" }}>
            Inbox &amp; activity notes
          </h2>
          {inboxNotes && inboxNotes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "14px", lineHeight: 1.5 }}>
              {inboxNotes.map((n) => (
                <li key={n.id} style={{ marginBottom: "10px" }}>
                  <span style={{ color: "#6b7280", fontSize: "12px" }}>
                    {n.thread_id ? `Thread ${n.thread_id.slice(0, 8)}… · ` : "Profile · "}
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: "4px" }}>{n.content}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              No inbox notes yet. Add notes from the Inbox or edit profile notes below.
            </p>
          )}
        </div>

        <div style={{ marginTop: "20px" }}>
          <EditLeadForm lead={lead} />
        </div>
      </section>
    </main>
  );
}

type DetailRowProps = {
  label: string;
  value: string | null;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <span style={{ fontSize: "13px", color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: "14px", color: "#111", fontWeight: 500 }}>
        {value ?? "—"}
      </span>
    </div>
  );
}
