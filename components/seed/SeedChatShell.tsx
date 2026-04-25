"use client";

import type { UseAssistantResult } from "@/lib/ai/useAssistant";
import { SeedChatTranscript } from "./SeedChatTranscript";
import { SeedComposer } from "./SeedComposer";

type SeedChatShellProps = {
  assistant: UseAssistantResult;
  variant?: "action" | "drawer";
  /** Extra bottom padding so last message clears the fixed composer */
  bottomSpacerClassName?: string;
};

export function SeedChatShell({ assistant, variant = "action", bottomSpacerClassName }: SeedChatShellProps) {
  const composer =
    variant === "drawer" ? (
      <div className="border-t border-white/10 bg-zinc-950/95 px-3 py-2.5 backdrop-blur">
        <SeedComposer assistant={assistant} variant="drawer" />
      </div>
    ) : (
      <div className="border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <SeedComposer assistant={assistant} variant="action" />
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SeedChatTranscript
        assistant={assistant}
        variant={variant}
        className={`min-h-0 flex-1 overflow-y-auto px-3 py-3 ${bottomSpacerClassName ?? ""}`}
      />
      {composer}
    </div>
  );
}
