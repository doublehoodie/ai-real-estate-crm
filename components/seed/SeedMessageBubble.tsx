"use client";

import { Sparkles } from "lucide-react";
import type { AssistantMessageContent, ExecuteActionPayload } from "@/lib/ai/useAssistant";

type SeedMessageBubbleProps = {
  role: "user" | "assistant";
  content: AssistantMessageContent;
  onExecuteAction?: (payload: ExecuteActionPayload) => void;
  variant?: "action" | "drawer";
  actionBusy?: boolean;
};

export function SeedMessageBubble({
  role,
  content,
  onExecuteAction,
  variant = "action",
  actionBusy = false,
}: SeedMessageBubbleProps) {
  const isUser = role === "user";
  const textUser =
    variant === "drawer"
      ? "ml-auto max-w-[92%] rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-[13px] leading-relaxed text-slate-900 dark:text-white"
      : "ml-auto max-w-[92%] rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-[14px] leading-relaxed text-slate-900 dark:text-white";

  if (typeof content === "string") {
    if (isUser) {
      return <div className={textUser}>{content}</div>;
    }
    return (
      <div className="flex max-w-[92%] gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-medium text-emerald-400/90">Seed</div>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{content}</div>
        </div>
      </div>
    );
  }

  if (content.type === "seed_response") {
    return (
      <div className="flex max-w-[92%] gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-medium text-emerald-400/90">Seed</div>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{content.text}</div>
          {(content.actions?.length ?? 0) > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {content.actions?.map((action, i) => {
                const mappedAction =
                  action.type === "schedule"
                    ? "schedule_meeting"
                    : action.type === "view_lead"
                      ? "view_lead"
                      : "draft_message";

                return (
                  <button
                    key={`${action.type}-${action.leadId ?? "none"}-${i}`}
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      action.leadId
                        ? onExecuteAction?.({ action: mappedAction, leadId: action.leadId })
                        : action.type === "view_lead"
                          ? (window.location.href = "/leads")
                          : undefined
                    }
                    className="rounded-full border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (content.type !== "action_recommendation") {
    return (
      <div className="flex max-w-[92%] gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 text-[13px] text-slate-700 dark:text-slate-300">Unsupported assistant message.</div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[92%] gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-medium text-emerald-400/90">Seed</div>
        <div className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{content.title}</div>
        <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{content.subtitle}</div>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{content.description}</p>

        <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={actionBusy}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_18px_rgba(34,197,94,0.25)] disabled:opacity-50"
            onClick={() =>
              onExecuteAction?.({ action: content.primaryAction.action, leadId: content.leadId })
            }
          >
            {content.primaryAction.label}
          </button>
          {content.steps.map((step, idx) => (
            <button
              key={`${step.action}-${idx}`}
              type="button"
              disabled={actionBusy}
              className="rounded-full border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500/40 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              onClick={() => onExecuteAction?.({ action: step.action, leadId: content.leadId })}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
