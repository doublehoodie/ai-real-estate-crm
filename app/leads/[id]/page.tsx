import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/lead";
import { AppLayout } from "@/components/layout/AppLayout";
import { displayBudgetText, formatBudgetValueUsd } from "@/lib/format";
import { resolveLeadScoring } from "@/lib/scoring";
import { AIExplainabilityPanel } from "@/components/AIExplainabilityPanel";
import { EditLeadForm } from "@/components/EditLeadForm";
import { LeadDetailFavorite } from "@/components/LeadDetailFavorite";
import { LeadScheduleButton } from "@/components/LeadScheduleButton";
import { LeadEventsSection } from "@/components/LeadEventsSection";
import { LeadEventsHistorySection } from "@/components/LeadEventsHistorySection";

type LeadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    notFound();
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
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
    <AppLayout active="leads" title={lead.name || "Untitled lead"} description="Lead details and activity overview">
        <div className="mb-4">
          <Link
            href="/leads"
            className="inline-flex rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 px-3 py-1.5 text-[13px] text-slate-900 dark:text-white transition-all duration-200 hover:bg-slate-200 dark:hover:bg-neutral-700"
          >
            ← Back to leads
          </Link>
        </div>

        <div className="mb-1 flex flex-wrap items-center gap-2.5">
          <LeadDetailFavorite leadId={lead.id} initialFavorite={lead.is_favorite === true} />
          <LeadScheduleButton lead={lead} />
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{lead.name || "Untitled lead"}</h2>
        </div>
        <p className="mb-6 mt-0 text-sm text-slate-600 dark:text-slate-400">Lead details and activity overview</p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
            <h2 className="mb-4 mt-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              Contact information
            </h2>

            <DetailRow label="Name" value={lead.name} />
            <DetailRow label="Email" value={lead.email} />
            <DetailRow label="Phone" value={lead.phone} />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
            <h2 className="mb-4 mt-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              Buying profile
            </h2>

            <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-neutral-800 py-2">
              <span className="text-[13px] text-slate-600 dark:text-slate-400">Budget</span>
              <div className="max-w-[65%] text-right">
                <span className="whitespace-pre-wrap text-[14px] font-medium text-slate-900 dark:text-white">
                  {displayBudgetText(lead.budget)}
                </span>
                {lead.budget_value != null && (
                  <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
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
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
          <h2 className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">Score Insights</h2>
          <AIExplainabilityPanel lead={lead} />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
          <h2 className="mb-3 mt-0 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            Inbox &amp; activity notes
          </h2>
          {inboxNotes && inboxNotes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "18px", color: "rgb(51 65 85)", fontSize: "14px", lineHeight: 1.5 }}>
              {inboxNotes.map((n) => (
                <li key={n.id} style={{ marginBottom: "10px" }}>
                  <span style={{ color: "rgb(100 116 139)", fontSize: "12px" }}>
                    {n.thread_id ? `Thread ${n.thread_id.slice(0, 8)}… · ` : "Profile · "}
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: "4px" }}>{n.content}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "rgb(100 116 139)", fontSize: "14px" }}>
              No inbox notes yet. Add notes from the Inbox or edit profile notes below.
            </p>
          )}
        </div>

        <LeadEventsSection leadId={lead.id} />

        <div className="mt-5">
          <EditLeadForm lead={lead} />
        </div>

        <LeadEventsHistorySection leadId={lead.id} />
    </AppLayout>
  );
}

type DetailRowProps = {
  label: string;
  value: string | null;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-neutral-800 py-2">
      <span className="text-[13px] text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-[14px] font-medium text-slate-900 dark:text-white">
        {value ?? "—"}
      </span>
    </div>
  );
}
