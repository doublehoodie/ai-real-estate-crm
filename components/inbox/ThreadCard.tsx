"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Check, Pencil, Reply, Send, Star, UserPlus } from "lucide-react";
import type { InboxThreadSummary, ThreadMessageDetail } from "@/types/inbox";
import { EmailMessageBody } from "./EmailMessageBody";

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
  borderColor: "#1bbff6",
  background: "#1bbff6",
  color: "white",
};

type ThreadCardProps = {
  thread: InboxThreadSummary;
  expanded: boolean;
  onToggle: () => void;
  detailMessages: ThreadMessageDetail[] | undefined;
  detailLoading: boolean;
  linking: boolean;
  onAddLead: () => void;
  onToggleFavorite: () => void;
  onMarkDone: () => void;
  onSchedulePlaceholder: () => void;
  onNoteSaved: () => void;
  onOpenFollowUp: () => void;
  onOpenReply: () => void;
};

export function ThreadCard({
  thread,
  expanded,
  onToggle,
  detailMessages,
  detailLoading,
  linking,
  onAddLead,
  onToggleFavorite,
  onMarkDone,
  onSchedulePlaceholder,
  onNoteSaved,
  onOpenFollowUp,
  onOpenReply,
}: ThreadCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState(false);

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

  const hasLead = Boolean(thread.lead);
  const unlinked = !hasLead;

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        background: "white",
        overflow: "hidden",
        borderLeftWidth: thread.needs_attention ? 4 : 1,
        borderLeftColor: thread.needs_attention ? "#f59e0b" : "#e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          border: "none",
          background: expanded ? "#f8fafc" : "white",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <strong className="text-[15px] text-gray-900">{thread.subject || "(No subject)"}</strong>
              {thread.needs_attention && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#b45309",
                    background: "#fffbeb",
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  Needs action
                </span>
              )}
            </div>
            <p style={{ margin: "0 0 6px", color: "#4b5563", fontSize: "13px", lineHeight: 1.4 }}>
              {thread.latest_snippet || "—"}
            </p>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              {thread.message_count} message{thread.message_count === 1 ? "" : "s"} · Provider: Gmail
            </div>
          </div>
          <time style={{ fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
            {new Date(thread.latest_at).toLocaleString()}
          </time>
        </div>

        <div
          style={{
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {hasLead && thread.lead ? (
            <span style={{ fontSize: "13px", color: "#1bbff6" }}>
              Linked lead:{" "}
              <Link href={`/leads/${thread.lead.id}`} style={{ fontWeight: 600, textDecoration: "underline" }}>
                {thread.lead.name || thread.lead.email || "View lead"}
              </Link>
            </span>
          ) : (
            <span style={{ fontSize: "13px", color: "#9ca3af" }}>No lead linked</span>
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
                border: "1px solid #1bbff6",
                background: "white",
                cursor: linking ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserPlus className="h-4 w-4" strokeWidth={2} color="#1bbff6" aria-hidden />
            </button>
          )}
        </div>
      </button>

      <div
        style={{
          padding: "10px 16px 14px",
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
          onClick={onSchedulePlaceholder}
          style={iconBtn}
          title="Schedule"
          aria-label="Schedule"
        >
          <Calendar className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button type="button" onClick={() => setNoteOpen((o) => !o)} style={iconBtn} title="Note" aria-label="Note">
          <Pencil className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button type="button" onClick={onOpenFollowUp} style={iconBtn} title="Follow up" aria-label="Follow up">
          <Send className="h-4 w-4" strokeWidth={2} color="#374151" />
        </button>
        <button type="button" onClick={onOpenReply} style={iconBtnPrimary} title="Reply" aria-label="Reply">
          <Reply className="h-4 w-4" strokeWidth={2} color="#ffffff" />
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

      {expanded && (
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #e5e7eb", background: "white" }}>
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
      )}
    </article>
  );
}
