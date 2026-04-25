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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 className="m-0 text-lg font-semibold tracking-tight text-zinc-100">Reply</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="inline-flex cursor-pointer rounded-lg border border-white/10 bg-zinc-950 p-2 transition-colors hover:bg-zinc-800"
          >
            <X className="h-4 w-4 text-zinc-300" strokeWidth={2} />
          </button>
        </div>

        <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>To</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mb-2.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-2.5 w-full rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Thread context is preserved when you send in the same Gmail thread."
          className="mb-3 w-full rounded-xl border border-white/10 bg-zinc-950 p-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {error && <p style={{ color: "#fca5a5", fontSize: "13px", marginTop: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            title="Send"
            aria-label="Send"
            onClick={() => void handleSend()}
            className={`inline-flex items-center justify-center px-3 py-2 ${primaryButton}`}
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
