"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { primaryButton } from "@/lib/ui";

type ReplyModalProps = {
  open: boolean;
  initialTo: string;
  initialSubject: string;
  threadId: string;
  onClose: () => void;
  onSend: (payload: { to: string; subject: string; body: string; threadId: string }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
};

function ensureRePrefix(subject: string) {
  const t = subject.trim();
  if (/^re:\s*/i.test(t)) return t;
  return `Re: ${t}`;
}

export function ReplyModal({
  open,
  initialTo,
  initialSubject,
  threadId,
  onClose,
  onSend,
}: ReplyModalProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(() => ensureRePrefix(initialSubject));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setSubject(ensureRePrefix(initialSubject));
      setBody("");
      setError(null);
    }
  }, [open, initialTo, initialSubject]);

  if (!open) return null;

  async function handleSend() {
    setSending(true);
    setError(null);
    const result = await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim(), threadId });
    setSending(false);
    if (result.ok) {
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
          maxWidth: "560px",
          width: "100%",
          padding: "20px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 className="m-0 text-lg text-gray-900">Reply</h2>
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

        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>To</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: "10px",
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
          }}
        />

        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: "10px",
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
          }}
        />

        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Thread context is preserved when you send in the same Gmail thread."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            fontSize: "14px",
            fontFamily: "inherit",
            marginBottom: "12px",
          }}
        />

        {error && <p style={{ color: "#b91c1c", fontSize: "13px", marginTop: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            title="Send"
            aria-label="Send"
            onClick={() => void handleSend()}
            className={`inline-flex items-center justify-center rounded-[10px] border-0 px-3 py-2 ${primaryButton}`}
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
