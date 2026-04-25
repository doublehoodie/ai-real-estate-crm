"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Send, X } from "lucide-react";
import { buildReplySubject } from "@/lib/inbox";
import { inputFieldClass, primaryButton, secondaryButton } from "@/lib/ui";
import {
  closeFloatingCompose,
  getComposeState,
  setComposeContent,
  setComposeMinimized,
  setComposeOpen,
  setComposePosition,
  setComposeSubject,
  setComposeTo,
  useComposeStore,
} from "@/lib/stores/composeStore";

type ComposeDragSession = { startX: number; startY: number; initialX: number; initialY: number };

const MESSAGE_TEMPLATES = [
  "Hi — just checking in on next steps. What timing works best for you this week?",
  "Thanks again for your interest. I wanted to follow up and see if you had any questions I can answer.",
  "I'd love to schedule a quick call to go over options. Are you free for 15 minutes in the next few days?",
];

export function FloatingCompose() {
  const isOpen = useComposeStore((s) => s.isOpen);
  const mode = useComposeStore((s) => s.mode);
  const lead = useComposeStore((s) => s.lead);
  const to = useComposeStore((s) => s.to);
  const content = useComposeStore((s) => s.content);
  const subject = useComposeStore((s) => s.subject);
  const gmailThreadId = useComposeStore((s) => s.gmailThreadId);
  const isMinimized = useComposeStore((s) => s.isMinimized);
  const position = useComposeStore((s) => s.position);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const dragRef = useRef<ComposeDragSession | null>(null);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const { x, y } = getComposeState().position;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: x,
      initialY: y,
    };
  }, []);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session) return;
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    setComposePosition({
      x: session.initialX + dx,
      y: session.initialY + dy,
    });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSendError(null);
      setSending(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const headerTitle =
    lead?.name?.trim() || lead?.email?.trim() || to.trim() || (mode === "new" ? "New message" : "Reply");
  const modeLabel = mode === "reply" ? "Reply" : "New message";

  async function handleSend() {
    setSendError(null);
    const body = content.trim();
    if (!body) {
      setSendError("Message is empty.");
      return;
    }

    const toAddr = to.trim();
    if (!toAddr) {
      setSendError("Add a recipient.");
      return;
    }

    if (mode === "new") {
      if (!subject.trim()) {
        setSendError("Add a subject.");
        return;
      }
    }

    const subj =
      mode === "reply"
        ? (subject.trim() ? subject.trim() : buildReplySubject("(No subject)"))
        : subject.trim();

    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toAddr,
          subject: subj,
          body,
          ...(gmailThreadId ? { threadId: gmailThreadId } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSendError(data.error || "Send failed");
        return;
      }
      closeFloatingCompose();
    } catch {
      setSendError("Send failed");
    } finally {
      setSending(false);
    }
  }

  const readonlyFieldClass =
    `${inputFieldClass} cursor-default bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        className="pointer-events-auto absolute w-[min(100vw-24px,420px)] overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        style={{
          right: 24,
          bottom: 24,
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        role="dialog"
        aria-label={mode === "reply" ? "Reply" : "New message"}
      >
        <div
          className="flex cursor-grab select-none items-center gap-2 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 px-3 py-2 active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">{headerTitle}</p>
            <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">{modeLabel}</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isMinimized ? (
              <button
                type="button"
                title="Restore"
                aria-label="Restore"
                onClick={() => setComposeMinimized(false)}
                className="rounded-md border border-slate-200 dark:border-neutral-800 p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                title="Minimize"
                aria-label="Minimize"
                onClick={() => setComposeMinimized(true)}
                className="rounded-md border border-slate-200 dark:border-neutral-800 p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={() => setComposeOpen(false)}
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="space-y-2.5 p-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                To
              </label>
              {mode === "reply" ? (
                <div className={`${readonlyFieldClass} w-full py-2`}>{to || "—"}</div>
              ) : (
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className={inputFieldClass}
                  autoComplete="email"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Subject
              </label>
              {mode === "reply" ? (
                <div className={`${readonlyFieldClass} w-full py-2`}>
                  {subject || buildReplySubject("(No subject)")}
                </div>
              ) : (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className={inputFieldClass}
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Message
              </label>
              <textarea
                value={content}
                onChange={(e) => setComposeContent(e.target.value)}
                rows={6}
                className={`${inputFieldClass} min-h-[120px] resize-y font-sans leading-relaxed`}
                placeholder={mode === "reply" ? "Write your reply…" : "Write your message…"}
              />
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Templates</p>
              <div className="flex flex-col gap-1.5">
                {MESSAGE_TEMPLATES.map((t) => (
                  <button
                    key={t.slice(0, 40)}
                    type="button"
                    onClick={() => setComposeContent(t)}
                    className="rounded-md border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-left text-[12px] leading-snug text-slate-700 dark:text-slate-300 transition hover:border-emerald-500/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {sendError && <p className="text-xs text-red-300">{sendError}</p>}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-2">
              <button
                type="button"
                onClick={() => closeFloatingCompose()}
                className={`rounded-lg px-3 py-1.5 text-sm ${secondaryButton}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  sending ||
                  !content.trim() ||
                  (mode === "new" && (!to.trim() || !subject.trim()))
                }
                onClick={() => void handleSend()}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${primaryButton}`}
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
