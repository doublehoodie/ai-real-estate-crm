"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, List, Mail, RefreshCw, Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { buildReplySubject, pickContactEmailForLead, pickReplyTarget } from "@/lib/inbox";
import { threadLeadToLead } from "@/lib/inbox/threadLeadToLead";
import type { InboxThreadSummary, ThreadMessageDetail } from "@/types/inbox";
import { ThreadCard } from "./ThreadCard";
import { getSuggestedScheduleNotes } from "@/lib/calendar/suggestedActionText";
import { toDateInputValue } from "@/lib/calendar/localDateInputs";
import { openFloatingCalendarEditor } from "@/lib/stores/calendarEditorStore";
import { openFloatingCompose } from "@/lib/stores/composeStore";
import { primaryButton, secondaryButton } from "@/lib/ui";

type InboxTab = "all" | "favorites" | "action";

export function InboxPanel() {
  const [sessionReady, setSessionReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<InboxThreadSummary[]>([]);
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [inboxTab, setInboxTab] = useState<InboxTab>("all");
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, ThreadMessageDetail[]>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [linkingThreadId, setLinkingThreadId] = useState<string | null>(null);

  const displayedThreads = useMemo(() => {
    if (inboxTab === "favorites") {
      return threads.filter((t) => t.is_favorite);
    }
    if (inboxTab === "action") {
      return threads.filter((t) => t.needs_action);
    }
    return threads;
  }, [threads, inboxTab]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        setLoggedIn(Boolean(session?.user));
        setSessionReady(true);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const patchLocalThread = useCallback((threadId: string, patch: Partial<InboxThreadSummary>) => {
    setThreads((prev) => prev.map((t) => (t.thread_id === threadId ? { ...t, ...patch } : t)));
  }, []);

  const fetchEmailsFromDB = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/email/inbox", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load inbox");
        return;
      }
      setThreads(data.threads ?? []);
      setMailboxEmail(data.mailboxEmail ?? "");
      setDetailCache({});
    } catch (err) {
      console.error(err);
      setError("Failed to load inbox");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady || !loggedIn) return;
    void fetchEmailsFromDB();
  }, [sessionReady, loggedIn, fetchEmailsFromDB]);

  const syncInbox = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      console.log("🔄 Refresh clicked");
      const response = await fetch("/api/email/sync", {
        method: "POST",
        credentials: "include",
      });
      console.log("✅ Sync response", response.status);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to sync inbox");
        return;
      }
      await fetchEmailsFromDB();
    } catch (err) {
      console.error("❌ Sync failed", err);
      setError("Failed to sync inbox");
    } finally {
      setSyncing(false);
    }
  }, [fetchEmailsFromDB]);

  const connectGmail = useCallback(async () => {
    setError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) {
        setError(oauthError.message || "Failed to connect Gmail");
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error("Gmail OAuth failed", err);
      setError("Failed to connect Gmail");
    }
  }, []);

  useEffect(() => {
    if (!expandedThreadId) return;
    if (detailCache[expandedThreadId]) return;

    const id = expandedThreadId;
    setDetailLoadingId(id);

    void (async () => {
      try {
        const res = await fetch(`/api/inbox/thread/${encodeURIComponent(id)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.messages) {
          setDetailCache((prev) => ({ ...prev, [id]: data.messages as ThreadMessageDetail[] }));
        } else {
          setError(data.error || "Failed to load thread");
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load thread");
      } finally {
        setDetailLoadingId((cur) => (cur === id ? null : cur));
      }
    })();
  }, [expandedThreadId, detailCache]);

  async function openComposeReplyFromThread(thread: InboxThreadSummary) {
    setError(null);
    const target = pickReplyTarget(mailboxEmail, thread.messages);
    const contact = pickContactEmailForLead(mailboxEmail, thread.messages);
    const to = target?.to ?? contact?.email ?? thread.lead?.email?.trim() ?? "";
    const subject = buildReplySubject(thread.subject);

    let content = "";
    let lead = thread.lead ? threadLeadToLead(thread.lead) : null;
    if (thread.lead) {
      try {
        const res = await fetch("/api/ai/draft-message", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: thread.lead.id }),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        if (!res.ok) {
          setError(data.error || "Draft failed");
          return;
        }
        content = typeof data.message === "string" ? data.message : "";
      } catch (e) {
        console.error(e);
        setError("Draft failed");
        return;
      }
    }

    openFloatingCompose({
      mode: "reply",
      lead,
      to,
      subject,
      content,
      gmailThreadId: thread.thread_id,
    });
  }

  function openComposeNewFromThread(thread: InboxThreadSummary) {
    setError(null);
    const target = pickReplyTarget(mailboxEmail, thread.messages);
    const contact = pickContactEmailForLead(mailboxEmail, thread.messages);
    const to = target?.to ?? contact?.email ?? thread.lead?.email?.trim() ?? "";
    const lead = thread.lead ? threadLeadToLead(thread.lead) : null;
    openFloatingCompose({
      mode: "new",
      lead,
      to,
      subject: "",
      content: "",
      gmailThreadId: null,
    });
  }

  function openScheduleFromThread(thread: InboxThreadSummary) {
    if (!thread.lead) return;
    openFloatingCalendarEditor({
      lead: threadLeadToLead(thread.lead),
      draftEvent: {
        date: toDateInputValue(new Date()),
        time: null,
        notes: getSuggestedScheduleNotes(thread.lead),
      },
    });
  }

  async function handleAddLead(t: InboxThreadSummary) {
    const contact = pickContactEmailForLead(mailboxEmail, t.messages);
    if (!contact) {
      setError("Could not determine a contact email for this thread.");
      return;
    }
    setLinkingThreadId(t.thread_id);
    setError(null);
    try {
      const res = await fetch("/api/inbox/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: contact.email,
          name: contact.name,
          threadId: t.thread_id,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        setError(data.error || "Could not add lead");
        return;
      }
      await fetchEmailsFromDB();
    } catch (e) {
      console.error(e);
      setError("Could not add lead");
    } finally {
      setLinkingThreadId(null);
    }
  }

  async function toggleFavorite(t: InboxThreadSummary) {
    const next = !t.is_favorite;
    try {
      const res = await fetch("/api/inbox/thread-meta", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: t.thread_id, isFavorite: next }),
      });
      if (res.ok) {
        patchLocalThread(t.thread_id, { is_favorite: next });
      } else {
        const data = await res.json();
        setError(data.error || "Could not update favorite");
      }
    } catch (e) {
      console.error(e);
      setError("Could not update favorite");
    }
  }

  async function markDone(t: InboxThreadSummary) {
    try {
      const res = await fetch("/api/inbox/thread-meta", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: t.thread_id, needsAction: false }),
      });
      if (res.ok) {
        patchLocalThread(t.thread_id, { needs_action: false, needs_attention: false });
      } else {
        const data = await res.json();
        setError(data.error || "Could not update thread");
      }
    } catch (e) {
      console.error(e);
      setError("Could not update thread");
    }
  }

  const busy = fetching || syncing;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur transition-all duration-200 ease-out hover:scale-[1.01]">
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void syncInbox()}
          disabled={busy}
          title="Sync with Gmail"
          aria-label="Sync with Gmail"
          className={`inline-flex items-center justify-center p-2.5 ${primaryButton}`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
        </button>
        {sessionReady && loggedIn && (
          <button
            type="button"
            title="Connect Gmail"
            aria-label="Connect Gmail"
            onClick={() => void connectGmail()}
            className={`inline-flex items-center justify-center p-2 transition-all duration-200 ${secondaryButton}`}
          >
            <Mail className="h-4 w-4" aria-hidden />
          </button>
        )}
        {sessionReady && !loggedIn && (
          <span style={{ fontSize: "13px", color: "#64748b" }}>Log in to connect Gmail.</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setInboxTab("all")}
          className={`inline-flex items-center justify-center rounded-lg border p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523] ${
            inboxTab === "all"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700"
          }`}
          title="All threads"
          aria-label="All threads"
        >
          <List className="h-4 w-4" strokeWidth={2} color={inboxTab === "all" ? "#ffffff" : "#374151"} />
        </button>
        <button
          type="button"
          onClick={() => setInboxTab("favorites")}
          className={`inline-flex items-center justify-center rounded-lg border p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523] ${
            inboxTab === "favorites"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700"
          }`}
          title="Favorites"
          aria-label="Favorites"
        >
          <Star className="h-4 w-4" strokeWidth={2} color={inboxTab === "favorites" ? "#ffffff" : "#ca8a04"} />
        </button>
        <button
          type="button"
          onClick={() => setInboxTab("action")}
          className={`inline-flex items-center justify-center rounded-lg border p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523] ${
            inboxTab === "action"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700"
          }`}
          title="Needs action"
          aria-label="Needs action"
        >
          <AlertCircle className="h-4 w-4" strokeWidth={2} color={inboxTab === "action" ? "#ffffff" : "#b45309"} />
        </button>
      </div>

      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "13px" }}>
        Loads from the database on open. Use sync to pull new mail from Gmail.
      </p>

      {error && (
        <p style={{ color: "#dc2626", marginTop: 0, fontSize: "14px" }} role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-2">
        {displayedThreads.map((thread) => {
          const expanded = expandedThreadId === thread.thread_id;
          return (
            <ThreadCard
              key={thread.thread_id}
              thread={thread}
              expanded={expanded}
              onExpandedChange={(isExpanded) =>
                setExpandedThreadId((current) => {
                  if (!isExpanded) return current === thread.thread_id ? null : current;
                  return thread.thread_id;
                })
              }
              detailMessages={detailCache[thread.thread_id]}
              detailLoading={detailLoadingId === thread.thread_id}
              linking={linkingThreadId === thread.thread_id}
              onAddLead={() => void handleAddLead(thread)}
              onToggleFavorite={() => void toggleFavorite(thread)}
              onMarkDone={() => void markDone(thread)}
              onSchedule={() => openScheduleFromThread(thread)}
              onNoteSaved={() => void fetchEmailsFromDB()}
              onOpenComposeReply={() => void openComposeReplyFromThread(thread)}
              onOpenComposeNew={() => openComposeNewFromThread(thread)}
            />
          );
        })}
      </div>

      {displayedThreads.length === 0 && !fetching && !syncing && (
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "12px" }}>
          No threads in this view. Connect Gmail and sync, or switch tabs.
        </p>
      )}
    </div>
  );
}
