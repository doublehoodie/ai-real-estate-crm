"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, List, Mail, RefreshCw, Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { pickContactEmailForLead, pickReplyTarget } from "@/lib/inbox";
import type { InboxThreadSummary, ThreadMessageDetail } from "@/types/inbox";
import { FollowUpModal } from "./FollowUpModal";
import { ReplyModal } from "./ReplyModal";
import { ThreadCard } from "./ThreadCard";

type InboxTab = "all" | "favorites" | "action";

const tabBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

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
  const [followThread, setFollowThread] = useState<InboxThreadSummary | null>(null);
  const [replyThread, setReplyThread] = useState<InboxThreadSummary | null>(null);

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
      const res = await fetch("/api/email/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sync inbox");
        return;
      }
      await fetchEmailsFromDB();
    } catch (err) {
      console.error(err);
      setError("Failed to sync inbox");
    } finally {
      setSyncing(false);
    }
  }, [fetchEmailsFromDB]);

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

  async function sendEmail(payload: { to: string; subject: string; body: string; threadId: string }) {
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: data.error || "Send failed" };
      }
      return { ok: true as const };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Send failed" };
    }
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

  const replyTarget = replyThread ? pickReplyTarget(mailboxEmail, replyThread.messages) : null;

  const busy = fetching || syncing;

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void syncInbox()}
          disabled={busy}
          title="Sync with Gmail"
          aria-label="Sync with Gmail"
          style={{
            padding: "8px 10px",
            borderRadius: "10px",
            border: "none",
            background: busy ? "#9ca3af" : "#111827",
            color: "white",
            cursor: busy ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
        </button>
        {sessionReady && loggedIn && (
          <a
            href="/api/auth/google"
            title="Connect Gmail"
            aria-label="Connect Gmail"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              color: "#0f766e",
            }}
          >
            <Mail className="h-4 w-4" aria-hidden />
          </a>
        )}
        {sessionReady && !loggedIn && (
          <span style={{ fontSize: "13px", color: "#6b7280" }}>Log in to connect Gmail.</span>
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
          style={{
            ...tabBtn,
            borderColor: inboxTab === "all" ? "#111827" : "#e5e7eb",
            background: inboxTab === "all" ? "#f8fafc" : "white",
          }}
          title="All threads"
          aria-label="All threads"
        >
          <List className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button
          type="button"
          onClick={() => setInboxTab("favorites")}
          style={{
            ...tabBtn,
            borderColor: inboxTab === "favorites" ? "#ca8a04" : "#e5e7eb",
            background: inboxTab === "favorites" ? "#fffbeb" : "white",
          }}
          title="Favorites"
          aria-label="Favorites"
        >
          <Star className="h-4 w-4" strokeWidth={2} color="#ca8a04" />
        </button>
        <button
          type="button"
          onClick={() => setInboxTab("action")}
          style={{
            ...tabBtn,
            borderColor: inboxTab === "action" ? "#b45309" : "#e5e7eb",
            background: inboxTab === "action" ? "#fffbeb" : "white",
          }}
          title="Needs action"
          aria-label="Needs action"
        >
          <AlertCircle className="h-4 w-4" strokeWidth={2} color="#b45309" />
        </button>
      </div>

      <p style={{ margin: "0 0 12px", color: "#6b7280", fontSize: "13px" }}>
        Loads from the database on open. Use sync to pull new mail from Gmail.
      </p>

      {error && (
        <p style={{ color: "#b91c1c", marginTop: 0, fontSize: "14px" }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: "14px" }}>
        {displayedThreads.map((thread) => {
          const expanded = expandedThreadId === thread.thread_id;
          return (
            <ThreadCard
              key={thread.thread_id}
              thread={thread}
              expanded={expanded}
              onToggle={() => setExpandedThreadId(expanded ? null : thread.thread_id)}
              detailMessages={detailCache[thread.thread_id]}
              detailLoading={detailLoadingId === thread.thread_id}
              linking={linkingThreadId === thread.thread_id}
              onAddLead={() => void handleAddLead(thread)}
              onToggleFavorite={() => void toggleFavorite(thread)}
              onMarkDone={() => void markDone(thread)}
              onSchedulePlaceholder={() => console.log("Schedule clicked")}
              onNoteSaved={() => void fetchEmailsFromDB()}
              onOpenFollowUp={() => setFollowThread(thread)}
              onOpenReply={() => setReplyThread(thread)}
            />
          );
        })}
      </div>

      <FollowUpModal
        open={Boolean(followThread)}
        thread={followThread}
        onClose={() => setFollowThread(null)}
        onSend={async (body) => {
          if (!followThread) return { ok: false, error: "No thread" };
          const target = pickReplyTarget(mailboxEmail, followThread.messages);
          if (!target) {
            return { ok: false, error: "Could not resolve recipient" };
          }
          const subj = /^re:\s*/i.test(target.subject.trim()) ? target.subject.trim() : `Re: ${target.subject.trim()}`;
          return sendEmail({
            to: target.to,
            subject: subj,
            body,
            threadId: followThread.thread_id,
          });
        }}
      />

      <ReplyModal
        open={Boolean(replyThread)}
        initialTo={replyTarget?.to ?? ""}
        initialSubject={replyTarget?.subject ?? replyThread?.subject ?? ""}
        threadId={replyThread?.thread_id ?? ""}
        onClose={() => setReplyThread(null)}
        onSend={sendEmail}
      />

      {displayedThreads.length === 0 && !fetching && !syncing && (
        <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "12px" }}>
          No threads in this view. Connect Gmail and sync, or switch tabs.
        </p>
      )}
    </div>
  );
}
