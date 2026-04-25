"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Lead } from "@/types/lead";
import { computePriorityScore, prioritizeLeadsForActionWindow } from "@/lib/actionWindow/prioritizeLeads";
import { ActionWindowTrigger } from "./ActionWindowTrigger";
import { ActionWindowDrawer } from "./ActionWindowDrawer";
import { ActionLeadDetail } from "./ActionLeadDetail";
import { useAssistant } from "@/lib/ai/useAssistant";
import { SeedChatTranscript } from "@/components/seed/SeedChatTranscript";
import { SeedComposer } from "@/components/seed/SeedComposer";
import { CLIENT_STATE_RESET_EVENT } from "@/lib/state/clearAllState";
import { getScoreBucketCounts } from "@/lib/scoring/scoreBuckets";
import { scoreColorsFromAiScore } from "@/lib/ui/scoreColors";

type PanelView = "list" | "detail";
type QuickActionFilter = "all" | "hot_follow_up" | "new_leads" | "schedule_calls" | "clear_low_priority";

function leadNeedsAction(lead: Lead): boolean {
  const withNeedsAction = lead as Lead & { needs_action?: boolean | null };
  return withNeedsAction.needs_action === true;
}

function showActionWindowForPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return true;
  if (pathname === "/leads") return true;
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return true;
  return false;
}

export function ActionWindowRoot() {
  const pathname = usePathname();
  const routeOk = showActionWindowForPath(pathname);

  const [sessionOk, setSessionOk] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("list");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuickActionFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentPanelHeight, setRecentPanelHeight] = useState(320);
  const [resizingMessages, setResizingMessages] = useState(false);
  const drawerBodyRef = useRef<HTMLDivElement | null>(null);
  const assistant = useAssistant(selectedLead?.id);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) setSessionOk(false);
        setError(res.status === 401 ? "Sign in to see prioritized leads." : "Could not load leads.");
        return;
      }
      setSessionOk(true);
      const data = (await res.json()) as { leads?: Lead[] };
      setLeads((data.leads ?? []) as Lead[]);
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!routeOk) {
      setAuthChecked(false);
      setSessionOk(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/leads", { credentials: "include" });
      if (cancelled) return;
      setAuthChecked(true);
      if (res.ok) {
        setSessionOk(true);
        const data = (await res.json()) as { leads?: Lead[] };
        setLeads((data.leads ?? []) as Lead[]);
      } else {
        setSessionOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeOk]);

  useEffect(() => {
    const onReset = () => {
      setLeads([]);
      setSelectedLead(null);
      setView("list");
      setActiveFilter("all");
      setOpen(false);
      setError(null);
    };
    window.addEventListener(CLIENT_STATE_RESET_EVENT, onReset);
    return () => window.removeEventListener(CLIENT_STATE_RESET_EVENT, onReset);
  }, []);

  useEffect(() => {
    if (!routeOk) {
      setOpen(false);
      setView("list");
      setSelectedLead(null);
    }
  }, [routeOk]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const prioritized = useMemo(() => prioritizeLeadsForActionWindow(leads), [leads]);
  const { hotLeads, warmLeads, coldLeads } = useMemo(() => getScoreBucketCounts(prioritized), [prioritized]);
  const hotLeadsCount = hotLeads.length;
  const warmLeadsCount = warmLeads.length;
  const topLead = prioritized[0] ?? null;
  const prioritizedAndFiltered = useMemo(() => {
    const now = Date.now();
    if (activeFilter === "all") return prioritized;
    if (activeFilter === "hot_follow_up") {
      return prioritized.filter((lead) => leadNeedsAction(lead) || (lead.ai_score ?? 0) >= 70);
    }
    if (activeFilter === "new_leads") {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      return prioritized.filter((lead) => {
        const created = lead.created_at ? new Date(lead.created_at).getTime() : 0;
        return created > 0 && now - created <= sevenDaysMs;
      });
    }
    if (activeFilter === "schedule_calls") {
      return prioritized.filter((lead) => leadNeedsAction(lead) || computePriorityScore(lead) >= 55);
    }
    return prioritized.filter((lead) => computePriorityScore(lead) < 45);
  }, [prioritized, activeFilter]);

  useEffect(() => {
    console.log("SCORE BUCKET COUNTS", {
      hot: hotLeads.length,
      warm: warmLeads.length,
      cold: coldLeads.length,
    });
  }, [hotLeads.length, warmLeads.length, coldLeads.length]);

  useEffect(() => {
    if (!resizingMessages) return;
    const onMove = (event: MouseEvent) => {
      const hostHeight = drawerBodyRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = Math.floor(hostHeight * 0.8);
      const minHeight = 220;
      const viewportY = event.clientY;
      const footerReserve = 90;
      const proposed = hostHeight - viewportY + footerReserve;
      setRecentPanelHeight(Math.max(minHeight, Math.min(maxHeight, proposed)));
    };
    const onUp = () => setResizingMessages(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingMessages]);

  function handleClose() {
    setOpen(false);
    setView("list");
    setSelectedLead(null);
    setActiveFilter("all");
  }

  function goList() {
    setView("list");
    setSelectedLead(null);
  }

  function goDetail(lead: Lead) {
    setSelectedLead(lead);
    setView("detail");
  }

  const fabVisible = routeOk && authChecked && sessionOk;

  function greetingLabel(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <>
      <ActionWindowTrigger visible={fabVisible} onClick={() => setOpen(true)} />
      <ActionWindowDrawer open={open} onClose={handleClose} title="Seed">
        <div ref={drawerBodyRef} className="flex min-h-0 flex-1 flex-col">
          {view === "detail" && selectedLead ? (
            <div className="flex min-h-0 flex-none max-h-[46%] flex-col overflow-hidden border-b border-slate-200 dark:border-neutral-800">
              <ActionLeadDetail lead={selectedLead} onBack={goList} />
            </div>
          ) : view === "list" ? (
            <div className="flex-none border-b border-slate-200 dark:border-neutral-800 px-4 py-4">
              <div className="text-[11px] font-semibold tracking-wide text-emerald-400/90">GrassLeads</div>
              <div className="mt-1 text-base font-semibold leading-snug text-slate-900 dark:text-white">{greetingLabel()}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                Ask Seed anything about follow-ups, scheduling, or your pipeline.
              </p>
              {topLead ? (
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  <p>
                    You have {hotLeadsCount} hot lead{hotLeadsCount === 1 ? "" : "s"} and {warmLeadsCount} warm
                    lead{warmLeadsCount === 1 ? "" : "s"}.
                  </p>
                  <p className="mt-1">
                    <button
                      type="button"
                      onClick={() => goDetail(topLead)}
                      className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                    >
                      {topLead.name?.trim() || "Untitled lead"}
                    </button>{" "}
                    is ready for follow-up.
                  </p>
                  {hotLeadsCount > 0 ? (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">You have 1 high-value lead losing momentum.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilter("hot_follow_up")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeFilter === "hot_follow_up"
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-300 hover:border-emerald-500/35 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Hot
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("new_leads")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeFilter === "new_leads"
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-300 hover:border-emerald-500/35 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("schedule_calls")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeFilter === "schedule_calls"
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-300 hover:border-emerald-500/35 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Calls
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("clear_low_priority")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeFilter === "clear_low_priority"
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-300 hover:border-emerald-500/35 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Low priority
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    activeFilter === "all"
                      ? "bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white"
                      : "border border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-300 hover:border-emerald-500/35 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  All
                </button>
              </div>

              {loading && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading leads…</p>}
              {error && !loading ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

              <div className="mt-4 max-h-40 overflow-y-auto">
                {prioritizedAndFiltered.length === 0 && !loading && !error ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No leads yet.</p>
                ) : null}
                <div className="divide-y divide-slate-200 dark:divide-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-800">
                  {prioritizedAndFiltered.slice(0, 10).map((lead) => {
                    const score = typeof lead.ai_score === "number" ? Math.round(lead.ai_score) : null;
                    const colors = scoreColorsFromAiScore(score);
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => goDetail(lead)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 truncate">{lead.name?.trim() || "Untitled lead"}</span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 tabular-nums text-xs ${colors.pillClass}`}>
                          {score ?? "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {view === "list" ? (
            <div
              className="mt-auto flex shrink-0 flex-col border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950"
              style={{ height: `${recentPanelHeight}px` }}
            >
              <button
                type="button"
                aria-label="Resize recent messages"
                onMouseDown={() => setResizingMessages(true)}
                className="flex h-3 w-full cursor-row-resize items-center justify-center bg-slate-200 dark:bg-neutral-900 hover:bg-slate-300 dark:hover:bg-neutral-800"
              >
                <span className="h-1 w-12 rounded-full bg-slate-500 dark:bg-slate-500" />
              </button>
              <div className="border-b border-slate-200 dark:border-neutral-800 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Recent Messages</p>
              </div>
              <SeedChatTranscript
                assistant={assistant}
                variant="drawer"
                className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
              />
              <div className="shrink-0 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 px-3 py-2.5 backdrop-blur">
                <SeedComposer assistant={assistant} variant="drawer" />
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 px-3 py-2.5 backdrop-blur">
              <SeedComposer assistant={assistant} variant="drawer" />
            </div>
          )}
        </div>
      </ActionWindowDrawer>
    </>
  );
}
