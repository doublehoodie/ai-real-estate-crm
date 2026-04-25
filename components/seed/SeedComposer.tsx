"use client";

import { useState } from "react";
import type { UseAssistantResult } from "@/lib/ai/useAssistant";

type SeedComposerProps = {
  assistant: UseAssistantResult;
  variant?: "action" | "drawer";
  className?: string;
};

export function SeedComposer({ assistant, variant = "action", className }: SeedComposerProps) {
  const [value, setValue] = useState("");
  const { sendMessage, loading, actionBusy } = assistant;
  const busy = loading || actionBusy;

  const handleSend = async () => {
    if (!value.trim()) return;
    const current = value;
    setValue("");
    await sendMessage(current);
  };

  if (variant === "drawer") {
    return (
      <div className={className}>
        <form
          className="mx-auto flex w-full max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Message Seed…"
            className="min-w-0 flex-1 rounded-full border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
            aria-label="Message Seed"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(34,197,94,0.25)] disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={className}>
      <form
        className="mx-auto flex w-full max-w-3xl items-center gap-2 sm:px-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Message Seed…"
          className="min-w-0 flex-1 rounded-full border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/45 disabled:opacity-50"
          aria-label="Message Seed"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(34,197,94,0.35)] transition hover:from-emerald-400 hover:to-green-500 disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
