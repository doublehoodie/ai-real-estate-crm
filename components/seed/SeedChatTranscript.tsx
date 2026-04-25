"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { UseAssistantResult } from "@/lib/ai/useAssistant";
import { SeedMessageBubble } from "./SeedMessageBubble";

type SeedChatTranscriptProps = {
  assistant: UseAssistantResult;
  variant?: "action" | "drawer";
  className?: string;
  emptyState?: ReactNode;
};

export function SeedChatTranscript({
  assistant,
  variant = "action",
  className,
  emptyState,
}: SeedChatTranscriptProps) {
  const { messages, loading, actionBusy, executeAction } = assistant;

  return (
    <div className={className}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:px-2">
        {messages.length === 0 && !loading ? emptyState : null}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <SeedMessageBubble
              role={m.role}
              content={m.content}
              variant={variant}
              actionBusy={actionBusy}
              onExecuteAction={(payload) => {
                void executeAction(payload);
              }}
            />
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="flex max-w-[92%] gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300/90">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-1 text-[12px] text-zinc-500">Seed is thinking…</div>
            </div>
          </div>
        ) : null}
        {actionBusy && !loading ? (
          <div className="flex justify-start">
            <div className="flex max-w-[92%] gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300/90">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-1 text-[12px] text-zinc-500">Running action…</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
