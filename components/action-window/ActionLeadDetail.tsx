"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { Lead, LeadAiNextAction } from "@/types/lead";
import { aiConfidenceTier } from "@/lib/leadConfidence";
import { formatAiSignalsSections } from "@/lib/actionWindow/formatAiSignals";
import { primaryButton, secondaryButton } from "@/lib/ui";

type ActionLeadDetailProps = {
  lead: Lead;
  onBack: () => void;
};

function scoreDisplay(lead: Lead): string {
  const s = lead.ai_score;
  if (typeof s === "number" && Number.isFinite(s)) return String(Math.round(s));
  return "—";
}

function nextActionBlock(lead: Lead): { title: string; body: string } | null {
  const na = lead.ai_next_action;
  if (!na || typeof na !== "object" || Array.isArray(na)) return null;
  const o = na as LeadAiNextAction;
  const action = typeof o.action === "string" ? o.action.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  const priority = o.priority;
  if (!action && !reason) return null;
  const parts: string[] = [];
  if (priority) parts.push(`Priority: ${priority}`);
  if (action) parts.push(action);
  if (reason) parts.push(reason);
  return { title: "Next action", body: parts.join("\n\n") };
}

export function ActionLeadDetail({ lead, onBack }: ActionLeadDetailProps) {
  const tier = aiConfidenceTier(lead.ai_confidence);
  const signalSections = formatAiSignalsSections(lead.ai_signals);
  const nextBlock = nextActionBlock(lead);

  const [followUpDraft, setFollowUpDraft] = useState("");
  const [followUpPhase, setFollowUpPhase] = useState<"idle" | "preview">("idle");
  const [followUpSending, setFollowUpSending] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  async function confirmSendFollowUp() {
    const to = lead.email?.trim() ?? "";
    const body = followUpDraft.trim();
    if (!to || !body) {
      setFollowUpError("Lead email and message are required.");
      return;
    }
    setFollowUpSending(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFollowUpError(data.error || "Failed to send.");
        return;
      }
      setFollowUpPhase("idle");
    } catch {
      setFollowUpError("Failed to send follow-up email.");
    } finally {
      setFollowUpSending(false);
    }
  }

  function cancelFollowUpFlow() {
    setFollowUpPhase("idle");
    setFollowUpError(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center gap-2 px-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-neutral-700"
          aria-label="Back to list"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
        <div>
          <h2 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{lead.name?.trim() || "Untitled lead"}</h2>
          {lead.email ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{lead.email}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{scoreDisplay(lead)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confidence</div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.className}`}>
              {tier.label}
            </span>
          </div>
        </div>

        {lead.has_contradictions ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Signals may conflict. Review notes and inbox for this lead.
          </p>
        ) : null}

        <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Summary</div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {lead.ai_summary?.trim() || "No AI summary available yet."}
          </p>
        </div>

        {signalSections.length > 0 ? (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key signals</div>
            <ul className="space-y-3">
              {signalSections.map((sec) => (
                <li key={sec.title}>
                  <div className="mb-1 text-xs font-medium text-slate-900 dark:text-white">{sec.title}</div>
                  <ul className="m-0 list-disc space-y-1 pl-4 text-xs text-slate-700 dark:text-slate-400">
                    {sec.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {nextBlock ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{nextBlock.title}</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{nextBlock.body}</p>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Follow-up preview</div>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {lead.ai_followup?.trim() || "No suggested follow-up text yet."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800 p-3">
          <p className="m-0 text-sm font-medium text-slate-900 dark:text-white">Work this lead with Seed</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            Use the composer below — try <span className="font-medium text-slate-900 dark:text-white">follow up</span>,{" "}
            <span className="font-medium text-slate-900 dark:text-white">schedule</span>, or{" "}
            <span className="font-medium text-slate-900 dark:text-white">details</span>.
          </p>
        </div>

        {followUpPhase === "preview" ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="mb-2 text-xs font-medium text-slate-900 dark:text-white">Preview — confirm to send</div>
            <textarea
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              rows={6}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {followUpError ? <p className="mb-2 text-xs text-red-300">{followUpError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButton}
                disabled={followUpSending || !lead.email?.trim() || !followUpDraft.trim()}
                onClick={() => void confirmSendFollowUp()}
              >
                {followUpSending ? "Sending…" : "Confirm & send"}
              </button>
              <button type="button" className={secondaryButton} disabled={followUpSending} onClick={cancelFollowUpFlow}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
