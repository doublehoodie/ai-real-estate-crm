"use client";

import { useState } from "react";
import type { Lead } from "@/types/lead";
import { AIExplainabilityPanel } from "@/components/AIExplainabilityPanel";
import {
  FOLLOW_UP_TEMPLATES,
  FOLLOW_UP_TEMPLATE_BUTTONS,
  type FollowUpTemplateKey,
} from "@/lib/ai/followUpTemplates";

export function LeadFollowUpPanel({ lead }: { lead: Lead }) {
  const [draft, setDraft] = useState(lead.ai_followup ?? "");
  const [activeTemplate, setActiveTemplate] = useState<FollowUpTemplateKey | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = lead.name?.split(" ")[0] || "";
  const hasAiFollowup = Boolean(lead.ai_followup && lead.ai_followup.trim().length > 0);

  function applyTemplate(type: FollowUpTemplateKey) {
    setDraft(FOLLOW_UP_TEMPLATES[type](firstName));
    setActiveTemplate(type);
    setSent(false);
    setError(null);
  }

  async function sendFollowupEmail() {
    const to = lead.email?.trim() ?? "";
    const body = draft.trim();
    if (!to || !body) {
      setError("Lead email and follow-up message are required.");
      return;
    }

    setSending(true);
    setSent(false);
    setError(null);

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Failed to send follow-up email.");
        return;
      }
      setSent(true);
      window.setTimeout(() => setSent(false), 4000);
    } catch (e) {
      console.error("[LeadFollowUpPanel] send error", e);
      setError("Failed to send follow-up email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-lg">
      <AIExplainabilityPanel lead={lead} compact className="mb-4" />
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Quick Templates</div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FOLLOW_UP_TEMPLATE_BUTTONS.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => applyTemplate(template.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-neutral-800 ${
              activeTemplate === template.key
                ? "border-[#1AB523] text-[#1AB523]"
                : "border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {template.label}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Suggested Follow-up</div>
      {!hasAiFollowup && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">No AI follow-up available yet</p>}
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setActiveTemplate(null);
        }}
        rows={5}
        className="w-full rounded-md border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1AB523]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void sendFollowupEmail()}
          disabled={sending || !lead.email || !draft.trim()}
          className="rounded-lg bg-[#1AB523] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#169e1f] disabled:cursor-default disabled:bg-gray-300"
        >
          {sending ? "Sending..." : "Send Email"}
        </button>
        {sent && <span className="text-xs text-emerald-700 dark:text-emerald-300">Sent</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
