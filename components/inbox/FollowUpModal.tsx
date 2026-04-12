"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type { InboxThreadSummary } from "@/types/inbox";

const TEMPLATES = [
  "Hi — just checking in on next steps. What timing works best for you this week?",
  "Thanks again for your interest. I wanted to follow up and see if you had any questions I can answer.",
  "I'd love to schedule a quick call to go over options. Are you free for 15 minutes in the next few days?",
];

type FollowUpModalProps = {
  open: boolean;
  thread: InboxThreadSummary | null;
  onClose: () => void;
  onSend: (body: string) => Promise<{ ok: boolean; error?: string }>;
};

export function FollowUpModal({ open, thread, onClose, onSend }: FollowUpModalProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !thread) return null;

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await onSend(body.trim());
    setSending(false);
    if (result.ok) {
      setBody("");
      onClose();
    } else {
      setError(result.error ?? "Could not send");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          maxWidth: "520px",
          width: "100%",
          padding: "20px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#111827" }}>Follow up</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>{thread.subject}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              display: "inline-flex",
            }}
          >
            <X className="h-4 w-4" strokeWidth={2} color="#374151" />
          </button>
        </div>

        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "10px",
            padding: "12px",
            marginTop: "14px",
            marginBottom: "14px",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          <strong style={{ display: "block", marginBottom: "4px" }}>AI suggestion (placeholder)</strong>
          Suggest acknowledging their last message and proposing one concrete next step (e.g. a call time).
        </div>

        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Templates</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.slice(0, 24)}
              type="button"
              onClick={() => setBody(t)}
              style={{
                textAlign: "left",
                fontSize: "13px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your follow-up..."
          rows={6}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            padding: "10px",
            fontSize: "14px",
            marginBottom: "12px",
            fontFamily: "inherit",
          }}
        />

        {error && <p style={{ color: "#b91c1c", fontSize: "13px", marginTop: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={sending || !body.trim()}
            title="Send"
            aria-label="Send"
            onClick={() => void handleSend()}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "none",
              background: sending || !body.trim() ? "#9ca3af" : "#111827",
              color: "white",
              cursor: sending || !body.trim() ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
