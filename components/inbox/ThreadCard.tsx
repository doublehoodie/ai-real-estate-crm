"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Check, Copy, Pencil, Reply, Send, Star, UserPlus } from "lucide-react";
import type { InboxThreadSummary, ThreadMessageDetail } from "@/types/inbox";
import {
  FOLLOW_UP_TEMPLATES,
  FOLLOW_UP_TEMPLATE_BUTTONS,
  type FollowUpTemplateKey,
} from "@/lib/ai/followUpTemplates";
import { AIExplainabilityPanel } from "@/components/AIExplainabilityPanel";
import { EmailMessageBody } from "./EmailMessageBody";
import { ThreadLeadEventsStrip } from "./ThreadLeadEventsStrip";

const iconBtn: React.CSSProperties = {
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconBtnPrimary: React.CSSProperties = {
  ...iconBtn,
  borderColor: "#1AB523",
  background: "#1AB523",
  color: "white",
};

type ThreadCardProps = {
  thread: InboxThreadSummary;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  detailMessages: ThreadMessageDetail[] | undefined;
  detailLoading: boolean;
  linking: boolean;
  onAddLead: () => void;
  onToggleFavorite: () => void;
  onMarkDone: () => void;
  onSchedule: () => void;
  onNoteSaved: () => void;
  onOpenComposeReply: () => void | Promise<void>;
  onOpenComposeNew: () => void;
};

export function ThreadCard({
  thread,
  expanded,
  onExpandedChange,
  detailMessages,
  detailLoading,
  linking,
  onAddLead,
  onToggleFavorite,
  onMarkDone,
  onSchedule,
  onNoteSaved,
  onOpenComposeReply,
  onOpenComposeNew,
}: ThreadCardProps) {
  const [viewState, setViewState] = useState<"collapsed" | "preview" | "expanded">("collapsed");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [followupDraft, setFollowupDraft] = useState(thread.lead?.ai_followup ?? "");
  const [activeTemplate, setActiveTemplate] = useState<FollowUpTemplateKey | null>(null);
  const [followupSending, setFollowupSending] = useState(false);
  const [followupSent, setFollowupSent] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);

  useEffect(() => {
    setFollowupDraft(thread.lead?.ai_followup ?? "");
    setActiveTemplate(null);
  }, [thread.thread_id, thread.lead?.ai_followup]);

  useEffect(() => {
    if (!expanded || viewState !== "expanded") return;
    const hasSummary =
      typeof thread.lead?.ai_summary === "string" && thread.lead.ai_summary.trim().length > 0;
    console.log("[inbox thread opened]", {
      threadId: thread.thread_id,
      leadId: thread.lead?.id ?? null,
      ai_processed: thread.lead?.ai_processed ?? null,
      hasAiSummary: hasSummary,
    });
  }, [expanded, viewState, thread.thread_id, thread.lead?.id, thread.lead?.ai_processed, thread.lead?.ai_summary]);

  useEffect(() => {
    if (viewState === "expanded") {
      onExpandedChange(true);
      return;
    }
    onExpandedChange(false);
  }, [onExpandedChange, viewState]);

  function cycleView() {
    setViewState((current) => {
      if (current === "collapsed") return "preview";
      if (current === "preview") return "expanded";
      return "collapsed";
    });
  }

  const orderedNotes = [...thread.notes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteSaving(true);
    setNoteError(null);
    setNoteSuccess(false);
    try {
      const res = await fetch("/api/inbox/notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.thread_id,
          leadId: thread.lead?.id ?? null,
          note: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoteError(data.error || "Failed to save note");
        return;
      }
      setNoteText("");
      setNoteOpen(false);
      setNoteSuccess(true);
      window.setTimeout(() => setNoteSuccess(false), 4000);
      onNoteSaved();
    } catch {
      setNoteError("Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function sendFollowupEmail() {
    const to = thread.lead?.email?.trim() ?? "";
    const body = followupDraft.trim();
    if (!to || !body) {
      setFollowupError("Lead email and follow-up message are required.");
      return;
    }

    setFollowupSending(true);
    setFollowupSent(false);
    setFollowupError(null);
    const payload = { to, body };
    console.log("[FOLLOWUP SEND STUB]", payload);

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFollowupError(data.error || "Failed to send follow-up email.");
        return;
      }

      setFollowupSent(true);
      window.setTimeout(() => setFollowupSent(false), 4000);
    } catch (error) {
      console.error("[FOLLOWUP SEND STUB ERROR]", error);
      setFollowupError("Failed to send follow-up email.");
    } finally {
      setFollowupSending(false);
    }
  }

  const hasLead = Boolean(thread.lead);
  const unlinked = !hasLead;
  const showAiInsights = Boolean(
    thread.lead &&
      (thread.lead.ai_processed === true ||
        (typeof thread.lead.ai_summary === "string" && thread.lead.ai_summary.trim().length > 0)),
  );
  const firstName = thread.lead?.name?.split(" ")[0] || "";

  function applyTemplate(type: FollowUpTemplateKey) {
    setFollowupDraft(FOLLOW_UP_TEMPLATES[type](firstName));
    setActiveTemplate(type);
    setFollowupError(null);
    setFollowupSent(false);
  }

  const scoreTone =
    (thread.lead?.ai_score ?? 0) >= 70
      ? "bg-green-50"
      : (thread.lead?.ai_score ?? 0) >= 40
        ? "bg-white"
        : "bg-white";

  return (
    <motion.article
      layout
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm ${scoreTone} dark:bg-neutral-900 ${thread.needs_attention ? "border-l-4 border-l-emerald-400 bg-green-50 border-green-400 dark:bg-neutral-900 dark:border-neutral-700" : ""}`}
    >
      <button
        type="button"
        onClick={cycleView}
        className="flex h-14 w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${thread.needs_attention ? "bg-emerald-400" : "bg-transparent ring-1 ring-slate-300 dark:ring-white/20"}`} />
          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{thread.messages[0]?.from_email || "Unknown sender"}</span>
          <span className="truncate text-sm text-slate-700 dark:text-slate-300">{thread.subject || "(No subject)"}</span>
        </div>
        <time className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{new Date(thread.latest_at).toLocaleString()}</time>
      </button>

      <AnimatePresence initial={false} mode="wait">
        {(viewState === "preview" || viewState === "expanded") && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 text-sm text-slate-700 dark:text-slate-300">{thread.latest_snippet || "—"}</p>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {thread.message_count} message{thread.message_count === 1 ? "" : "s"} · Provider: Gmail
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasLead && thread.lead ? (
                  <span className="text-xs text-[#1AB523]">
                    Linked lead:{" "}
                    <Link href={`/leads/${thread.lead.id}`} className="font-semibold underline">
                      {thread.lead.name || thread.lead.email || "View lead"}
                    </Link>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">No lead linked</span>
                )}
                {unlinked && (
                  <button
                    type="button"
                    disabled={linking}
                    title="Add as lead"
                    aria-label="Add as lead"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddLead();
                    }}
                    style={{
                      padding: "6px",
                      borderRadius: "8px",
                      border: "1px solid #1AB523",
                      background: "white",
                      cursor: linking ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UserPlus className="h-4 w-4" strokeWidth={2} color="#1AB523" aria-hidden />
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                padding: "10px 16px 12px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                borderTop: "1px solid #f3f4f6",
                background: "#fafafa",
              }}
            >
        <button type="button" onClick={onToggleFavorite} style={iconBtn} title="Favorite" aria-label="Favorite">
          <Star
            className="h-4 w-4"
            strokeWidth={2}
            fill={thread.is_favorite ? "#ca8a04" : "none"}
            color={thread.is_favorite ? "#ca8a04" : "#374151"}
          />
        </button>
        <button
          type="button"
          disabled={!hasLead}
          onClick={(e) => {
            e.stopPropagation();
            if (hasLead) onSchedule();
          }}
          style={{
            ...iconBtn,
            opacity: hasLead ? 1 : 0.45,
            cursor: hasLead ? "pointer" : "not-allowed",
          }}
          title={hasLead ? "Schedule with lead" : "Link a lead to schedule"}
          aria-label={hasLead ? "Schedule with lead" : "Schedule unavailable until lead is linked"}
        >
          <Calendar className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button type="button" onClick={() => setNoteOpen((o) => !o)} style={iconBtn} title="Note" aria-label="Note">
          <Pencil className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button
          type="button"
          onClick={() => void onOpenComposeReply()}
          style={iconBtnPrimary}
          title="Reply or follow-up"
          aria-label="Reply or follow-up"
        >
          <Reply className="h-4 w-4" strokeWidth={2} color="#ffffff" />
        </button>
        <button
          type="button"
          onClick={() => onOpenComposeNew()}
          style={iconBtn}
          title="New message"
          aria-label="New message"
        >
          <Send className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        {thread.needs_attention && (
          <button type="button" onClick={onMarkDone} style={iconBtn} title="Done" aria-label="Done">
            <Check className="h-4 w-4" strokeWidth={2} color="#374151" />
          </button>
        )}
            </div>

            {noteSuccess && (
        <div
          role="status"
          style={{
            margin: "0 16px 8px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "13px",
          }}
        >
          Note saved.
        </div>
            )}

            {noteOpen && (
        <div style={{ padding: "0 16px 14px", background: "#fafafa" }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Note (saved to this thread)"
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              padding: "8px",
              fontSize: "13px",
              fontFamily: "inherit",
            }}
          />
          {noteError && <p style={{ color: "#b91c1c", fontSize: "12px", margin: "4px 0" }}>{noteError}</p>}
          <button
            type="button"
            disabled={noteSaving || !noteText.trim()}
            title="Save note"
            aria-label="Save note"
            onClick={() => void saveNote()}
            style={{
              marginTop: "6px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: noteSaving || !noteText.trim() ? "#f3f4f6" : "white",
              cursor: noteSaving || !noteText.trim() ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check className="h-4 w-4" strokeWidth={2} color="#374151" />
          </button>
        </div>
            )}

            {orderedNotes.length > 0 && (
        <div style={{ padding: "0 16px 12px", background: "white", fontSize: "12px", color: "#4b5563" }}>
          <strong style={{ display: "block", marginBottom: "6px", color: "#6b7280" }}>Notes</strong>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {orderedNotes.map((n) => (
              <li key={n.id} style={{ marginBottom: "4px" }}>
                {n.note}
                <span style={{ color: "#9ca3af" }}> — {new Date(n.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewState === "expanded" && expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #e5e7eb", background: "white" }}>
          {hasLead && thread.lead ? <ThreadLeadEventsStrip leadId={thread.lead.id} /> : null}
          {showAiInsights && thread.lead && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
              <AIExplainabilityPanel lead={thread.lead} className="mb-4" />
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Suggested Follow-up
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    title="Copy suggested follow-up"
                    aria-label="Copy suggested follow-up"
                    onClick={() => void navigator.clipboard.writeText(followupDraft)}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copy
                  </button>
                </div>
                <textarea
                  value={followupDraft}
                  onChange={(e) => {
                    setFollowupDraft(e.target.value);
                    setActiveTemplate(null);
                  }}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1AB523]"
                />
                <div className="mt-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Quick Templates
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOW_UP_TEMPLATE_BUTTONS.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => applyTemplate(template.key)}
                        className={`rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          activeTemplate === template.key
                            ? "border-[#1AB523] text-[#1AB523]"
                            : "border-gray-300 text-gray-700"
                        }`}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void sendFollowupEmail()}
                    disabled={followupSending || !thread.lead?.email || !followupDraft.trim()}
                    className="rounded-lg bg-[#1AB523] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#169e1f] disabled:cursor-default disabled:bg-gray-300"
                  >
                    {followupSending ? "Sending..." : "Send Email"}
                  </button>
                  {followupSent && <span className="text-xs text-emerald-700">Follow-up sent.</span>}
                  {followupError && <span className="text-xs text-red-700">{followupError}</span>}
                </div>
              </div>
            </div>
          )}
          <strong style={{ fontSize: "13px", color: "#374151" }}>Conversation</strong>
          {detailLoading && <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading messages…</p>}
          {!detailLoading && detailMessages && detailMessages.length === 0 && (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>No messages in database for this thread.</p>
          )}
          {!detailLoading &&
            detailMessages?.map((m) => (
              <div
                key={m.message_id}
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: m.direction === "outbound" ? "#f0fdfa" : "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                  {m.direction === "outbound" ? "You" : "Them"} · {new Date(m.received_at).toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: "#4b5563", marginBottom: "6px" }}>
                  From: {m.from_email || "—"} → To: {m.to_email || "—"}
                </div>
                <EmailMessageBody bodyText={m.body_text} />
              </div>
            ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

