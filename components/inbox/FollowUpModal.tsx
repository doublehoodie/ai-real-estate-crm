"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type { InboxThreadSummary } from "@/types/inbox";
import { primaryButton } from "@/lib/ui";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-zinc-100">Follow up</h2>
            <p className="m-0 text-[13px] text-zinc-400">{thread.subject}</p>
          </div>
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

        <div className="mb-3 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-200">
          <strong className="mb-1 block">AI suggestion (placeholder)</strong>
          Suggest acknowledging their last message and proposing one concrete next step (e.g. a call time).
        </div>

        <p className="mb-1.5 text-xs text-zinc-400">Templates</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.slice(0, 24)}
              type="button"
              onClick={() => setBody(t)}
              className="cursor-pointer rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-2 text-left text-[13px] text-zinc-300 transition-colors hover:bg-zinc-800"
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
          className="mb-3 w-full rounded-xl border border-white/10 bg-zinc-950 p-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {error && <p className="mt-0 text-[13px] text-red-300">{error}</p>}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={sending || !body.trim()}
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
