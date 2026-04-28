"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAssistant } from "@/lib/ai/useAssistant";
import { SeedChatTranscript } from "@/components/seed/SeedChatTranscript";
import { SeedComposer } from "@/components/seed/SeedComposer";
import { buildActionPlan, resolveVisibleActions, type ActionId } from "@/lib/action/actionEngine";
import { DynamicActionBlocks } from "./DynamicActionBlocks";
import { openFloatingCompose } from "@/lib/stores/composeStore";
import { openFloatingCalendarEditor } from "@/lib/stores/calendarEditorStore";
import type { Lead } from "@/types/lead";
import { toDateInputValue } from "@/lib/calendar/localDateInputs";
import { CSVUploader } from "@/components/import/CSVUploader";
import { clearAssistantSessionMessages } from "@/lib/stores/assistantSessionStore";
import { getScoreBucketCounts } from "@/lib/scoring/scoreBuckets";
import { supabase } from "@/lib/supabaseClient";

type ActionLandingClientProps = {
  displayName: string;
  attentionCount: number;
  leadsCount: number;
  gmailConnected: boolean;
  hasHotLead: boolean;
  readyForMeeting: boolean;
};

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function ActionLandingClient({
  displayName,
  attentionCount,
  leadsCount,
  gmailConnected,
  hasHotLead,
  readyForMeeting,
}: ActionLandingClientProps) {
  const router = useRouter();
  const assistant = useAssistant();
  const hasMessages = assistant.messages.length > 0;
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [busyActionId, setBusyActionId] = useState<ActionId | null>(null);
  const [topLead, setTopLead] = useState<Lead | null>(null);
  const [hotLeadsCount, setHotLeadsCount] = useState(0);
  const [warmLeadsCount, setWarmLeadsCount] = useState(0);

  const actionContext = useMemo(
    () => ({
      leadsCount,
      gmailConnected,
      hasHotLead,
      readyForMeeting,
    }),
    [gmailConnected, hasHotLead, leadsCount, readyForMeeting],
  );

  const visibleActions = useMemo(() => resolveVisibleActions(actionContext), [actionContext]);

  const topAction = visibleActions[0] ?? null;

  const summary = useMemo(() => {
    if (importedCount != null) {
      return `You’ve imported ${importedCount} leads. Start with these.`;
    }
    if (leadsCount === 0) {
      return "You don’t have any leads yet. Let’s start by importing them.";
    }
    if (topAction && topAction.id === "connect_gmail") {
      return topAction.seedPrompt;
    }
    if (attentionCount === 0) {
      return "You are caught up on high-priority follow-ups.";
    }
    return `You have ${attentionCount} lead${attentionCount === 1 ? "" : "s"} that need attention.`;
  }, [attentionCount, importedCount, leadsCount, topAction]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeadContext() {
      const res = await fetch("/api/leads", { credentials: "include" });
      const payload = (await res.json().catch(() => ({}))) as { leads?: Lead[] };
      if (!res.ok || !Array.isArray(payload.leads) || cancelled) {
        return;
      }
      const list = payload.leads;
      const { hotLeads, warmLeads, coldLeads } = getScoreBucketCounts(list);
      const top = [...list].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0] ?? null;
      setHotLeadsCount(hotLeads.length);
      setWarmLeadsCount(warmLeads.length);
      setTopLead(top);
      console.log("SCORE BUCKET COUNTS", {
        hot: hotLeads.length,
        warm: warmLeads.length,
        cold: coldLeads.length,
      });
    }
    void loadLeadContext();
    return () => {
      cancelled = true;
    };
  }, [importedCount, hasMessages]);

  async function fetchTopLead(): Promise<Lead | null> {
    const res = await fetch("/api/leads", { credentials: "include" });
    const payload = (await res.json().catch(() => ({}))) as { leads?: Lead[] };
    if (!res.ok || !Array.isArray(payload.leads) || payload.leads.length === 0) return null;
    return [...payload.leads].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0] ?? null;
  }

  async function handleAction(actionId: ActionId, openPicker: () => void) {
    if (busyActionId) return;
    if (actionId === "import_csv") {
      openPicker();
      return;
    }
    if (actionId === "connect_gmail") {
      setBusyActionId(actionId);
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        console.error("Failed to connect Gmail", error);
        setBusyActionId(null);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setBusyActionId(null);
      return;
    }
    if (actionId === "add_lead") {
      router.push("/");
      return;
    }
    if (actionId === "follow_up") {
      setBusyActionId(actionId);
      const lead = await fetchTopLead();
      if (lead) {
        const draftRes = await fetch("/api/ai/draft-message", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id }),
        });
        const draftPayload = (await draftRes.json().catch(() => ({}))) as { message?: string };
        openFloatingCompose({
          mode: "reply",
          lead,
          to: lead.email?.trim() ?? "",
          subject: "Re: Checking in",
          content: draftPayload.message ?? "",
          gmailThreadId: null,
        });
      }
      setBusyActionId(null);
      return;
    }
    if (actionId === "schedule_meeting") {
      setBusyActionId(actionId);
      const lead = await fetchTopLead();
      if (lead) {
        openFloatingCalendarEditor({
          lead,
          draftEvent: {
            date: toDateInputValue(new Date()),
            time: null,
            notes: "Quick meeting to move next steps forward.",
          },
        });
      }
      setBusyActionId(null);
    }
  }

  return (
    <CSVUploader
      onImported={(count) => {
        setImportedCount(count);
        if (count > 0) {
          void assistant.sendMessage(`You’ve imported ${count} leads. Start with these.`);
        }
      }}
    >
      {({ openPicker, importing }) => {
        const actionHandlers = {
          import_csv: () => void handleAction("import_csv", openPicker),
          connect_gmail: () => void handleAction("connect_gmail", openPicker),
          add_lead: () => void handleAction("add_lead", openPicker),
          follow_up: () => void handleAction("follow_up", openPicker),
          schedule_meeting: () => void handleAction("schedule_meeting", openPicker),
        };
        const actionPlan = buildActionPlan(actionContext, actionHandlers);

        return (
          <div className="relative flex h-full min-h-screen flex-1 flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-1/4 top-0 h-[420px] w-[420px] rounded-full bg-emerald-600/15 blur-[120px]" />
              <div className="absolute -right-1/4 bottom-0 h-[380px] w-[380px] rounded-full bg-teal-500/10 blur-[100px]" />
              <div className="absolute left-1/2 top-1/3 h-px w-[min(80%,720px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-10 sm:px-8">
              <motion.header
                className="mx-auto flex max-w-2xl flex-col items-center text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="mb-4 text-[11px] font-semibold tracking-[0.35em] text-emerald-500/90">GRASSLEADS</p>
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  {greetingLabel()}, {displayName}
                </h1>
                <p className="mt-4 max-w-lg text-pretty text-base text-slate-600 dark:text-zinc-400 sm:text-lg">{summary}</p>
                {leadsCount > 0 ? (
                  <div className="mt-4 max-w-lg text-center text-sm text-slate-700 dark:text-zinc-300">
                    <p>
                      You have {hotLeadsCount} hot lead{hotLeadsCount === 1 ? "" : "s"} and {warmLeadsCount} warm
                      lead{warmLeadsCount === 1 ? "" : "s"}.
                    </p>
                    {topLead ? (
                      <p className="mt-1">
                        <button
                          type="button"
                          className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                          onClick={() => router.push(`/leads/${topLead.id}`)}
                        >
                          {topLead.name?.trim() || "Untitled lead"}
                        </button>
                      </p>
                    ) : null}
                    {hotLeadsCount > 0 ? <p className="mt-1 text-slate-600 dark:text-zinc-400">You have 1 high-value lead losing momentum.</p> : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => clearAssistantSessionMessages()}
                  className="mt-4 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-emerald-500/40 hover:text-slate-900 dark:border-white/15 dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  Clear Conversation
                </button>
              </motion.header>

              <DynamicActionBlocks actions={actionPlan} />
              {importing && (
                <p className="mx-auto mt-2 w-full max-w-4xl text-center text-xs text-emerald-300">
                  Importing leads...
                </p>
              )}

              {hasMessages ? (
                <div className="mx-auto mt-8 w-full max-w-3xl border-t border-slate-200 pt-6 dark:border-white/10 sm:px-2">
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Recent Messages</p>
                  <SeedChatTranscript assistant={assistant} variant="action" className="pb-6" />
                </div>
              ) : null}
            </div>

            <div className="pointer-events-none fixed bottom-0 left-[232px] right-0 z-20">
              <div className="pointer-events-auto border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/90">
                <SeedComposer assistant={assistant} variant="action" />
              </div>
            </div>
          </div>
        );
      }}
    </CSVUploader>
  );
}
