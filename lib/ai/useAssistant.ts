"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isUuid } from "@/lib/ids";
import type { AssistantMessageContent, ExecuteActionPayload } from "@/lib/ai/assistantSurfaceTypes";
export type {
  AssistantExecutableAction,
  AssistantStep,
  AssistantActionRecommendation,
  AssistantMessageContent,
  ExecuteActionPayload,
} from "@/lib/ai/assistantSurfaceTypes";
import {
  ASSISTANT_HIGH_SCORE_THRESHOLD,
  buildStructuredRecommendation,
  mapApiLeadsToDecisionLeads,
  recommendationFingerprint,
  type DecisionLead,
} from "@/lib/ai/buildAssistantRecommendation";
import { buildReplySubject } from "@/lib/inbox";
import { getNextWeekdayMeetingSlot } from "@/lib/calendar/suggestedMeetingSlots";
import { getSuggestedScheduleNotes } from "@/lib/calendar/suggestedActionText";
import { toDateInputValue, toTimeInputValue } from "@/lib/calendar/localDateInputs";
import { fetchLeadRowById } from "@/lib/execution/fetchLeadRowById";
import { openFloatingCalendarEditor } from "@/lib/stores/calendarEditorStore";
import { openFloatingCompose } from "@/lib/stores/composeStore";
import {
  setAssistantSessionMessages,
  useAssistantSessionMessages,
} from "@/lib/stores/assistantSessionStore";
import type { Lead } from "@/types/lead";

type PlanResult = {
  message?: string;
};

type AssistantRequestContext = {
  leads: DecisionLead[];
};

async function generateActionPlan(
  input: string,
  leadId: string | undefined,
  context: AssistantRequestContext,
): Promise<PlanResult> {
  const response = await fetch("/api/ai/assistant", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userInput: input, leadId, context }),
  });

  const payload = (await response.json().catch(() => ({}))) as PlanResult & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Assistant request failed (${response.status})`);
  }
  return payload;
}

function assistantFingerprint(content: AssistantMessageContent): string {
  if (typeof content === "string") return content;
  if (content.type === "action_recommendation") {
    return `${content.type}:${content.title}:${content.subtitle}`;
  }
  return "unknown";
}

function stubLead(leadId: string, name: string | null, email: string | null): Lead {
  return {
    id: leadId,
    name,
    email,
    phone: null,
    budget: null,
    budget_value: null,
    timeline: null,
    status: null,
    notes: null,
    is_favorite: null,
    ai_summary: null,
    ai_intent_level: null,
    ai_score: null,
    ai_score_breakdown: null,
    ai_confidence: null,
    ai_signals: null,
    ai_next_action: null,
    ai_followup: null,
    has_contradictions: null,
    ai_processed: null,
    needs_action: null,
    last_contact_at: null,
    ai_last_processed_at: null,
    created_at: null,
    updated_at: null,
  };
}

export type UseAssistantResult = {
  messages: ReturnType<typeof useAssistantSessionMessages>;
  loading: boolean;
  actionBusy: boolean;
  sendMessage: (input: string) => Promise<unknown>;
  executeAction: (payload: ExecuteActionPayload) => Promise<void>;
};

export function useAssistant(leadId?: string) {
  const router = useRouter();
  const messages = useAssistantSessionMessages();
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const activeLeadIdRef = useRef<string | undefined>(leadId);

  useEffect(() => {
    activeLeadIdRef.current = leadId;
  }, [leadId]);

  function applyAssistantMessageWithDedup(newContent: AssistantMessageContent) {
    setAssistantSessionMessages((prev) => {
      const lastUserMessage = prev[prev.length - 1];
      const prevUserMessage = prev[prev.length - 3];
      const shouldReplaceLastAssistant =
        lastUserMessage?.role === "user" &&
        prevUserMessage?.role === "user" &&
        typeof lastUserMessage.content === "string" &&
        typeof prevUserMessage.content === "string" &&
        lastUserMessage.content === prevUserMessage.content &&
        prev[prev.length - 2]?.role === "assistant" &&
        assistantFingerprint(prev[prev.length - 2]!.content) === assistantFingerprint(newContent);

      if (shouldReplaceLastAssistant) {
        const next = [...prev];
        next[prev.length - 2] = { role: "assistant", content: newContent };
        return next;
      }

      return [...prev, { role: "assistant" as const, content: newContent }];
    });
  }

  const refetchDecisionLeads = useCallback(async (): Promise<DecisionLead[]> => {
    const leadsRes = await fetch("/api/leads", { credentials: "include" });
    const leadsPayload = (await leadsRes.json().catch(() => ({}))) as {
      leads?: Array<{
        id?: string;
        name?: string | null;
        ai_score?: number | null;
        last_contact_at?: string | null;
        updated_at?: string | null;
        status?: string | null;
        ai_summary?: string | null;
      }>;
    };
    return mapApiLeadsToDecisionLeads(leadsPayload.leads);
  }, []);

  const appendRouteActionFeedback = useCallback(
    async (args: { actionResult: string; nextStep: string; warnPrematureMeeting?: string }) => {
      const leads = await refetchDecisionLeads();
      const lines = [args.actionResult, args.nextStep];
      if (args.warnPrematureMeeting) lines.push("", args.warnPrematureMeeting);
      const block = lines.join("\n");
      const structured = buildStructuredRecommendation(leads);

      setAssistantSessionMessages((prev) => {
        const withBlock = [...prev, { role: "assistant" as const, content: block }];
        if (!structured) return withBlock;

        const lastRec = [...prev]
          .reverse()
          .find(
            (m) =>
              m.role === "assistant" &&
              typeof m.content !== "string" &&
              m.content.type === "action_recommendation",
          );
        if (
          lastRec &&
          typeof lastRec.content !== "string" &&
          lastRec.content.type === "action_recommendation" &&
          recommendationFingerprint(lastRec.content) === recommendationFingerprint(structured)
        ) {
          return withBlock;
        }

        return [...withBlock, { role: "assistant", content: structured }];
      });
    },
    [refetchDecisionLeads],
  );

  const navigateAfterFeedback = useCallback(
    (href: string) => {
      window.setTimeout(() => {
        router.push(href);
      }, 120);
    },
    [router],
  );

  const executeAction = useCallback(
    async (payload: ExecuteActionPayload) => {
      const { action, leadId } = payload;
      if (!leadId || !isUuid(leadId)) {
        applyAssistantMessageWithDedup("That action needs a valid lead.");
        return;
      }

      setActionBusy(true);
      try {
        if (action === "view_lead") {
          await appendRouteActionFeedback({
            actionResult: "Opened lead detail.",
            nextStep: "Review the record, then return here if you want another Seed action.",
          });
          navigateAfterFeedback(`/leads/${leadId}`);
          return;
        }

        if (action === "draft_message") {
          const res = await fetch("/api/ai/draft-message", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
            leadName?: string;
            email?: string;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(data.error || "Draft request failed");
          }

          const leadRow = (await fetchLeadRowById(leadId)) ?? stubLead(leadId, data.leadName ?? null, data.email ?? null);

          openFloatingCompose({
            mode: "reply",
            lead: leadRow,
            to: leadRow.email?.trim() ?? "",
            subject: buildReplySubject("Connecting with you"),
            content: typeof data.message === "string" ? data.message : "",
            gmailThreadId: null,
          });

          await appendRouteActionFeedback({
            actionResult: "Draft generated; lead marked contacted.",
            nextStep: "Review the message in the floating compose window and send when ready.",
          });
          return;
        }

        if (action === "schedule_meeting") {
          const leads = await refetchDecisionLeads();
          const row = leads.find((l) => l.id === leadId);
          const warnPrematureMeeting =
            row && row.ai_score < ASSISTANT_HIGH_SCORE_THRESHOLD
              ? "This meeting may be premature. Consider confirming interest first."
              : undefined;

          const { start } = getNextWeekdayMeetingSlot();
          const leadFull = (await fetchLeadRowById(leadId)) ?? stubLead(leadId, row?.name ?? null, null);
          const notes = getSuggestedScheduleNotes(leadFull);

          openFloatingCalendarEditor({
            lead: leadFull,
            draftEvent: {
              date: toDateInputValue(start),
              time: toTimeInputValue(start),
              notes,
            },
          });

          await appendRouteActionFeedback({
            actionResult: "Calendar editor opened.",
            nextStep: "Confirm date and time in the floating panel, then save.",
            warnPrematureMeeting,
          });
          return;
        }
      } catch (e) {
        console.error("[executeAction]", e);
        applyAssistantMessageWithDedup(
          `Action failed. ${e instanceof Error ? e.message : ""}`.trim(),
        );
      } finally {
        setActionBusy(false);
      }
    },
    [appendRouteActionFeedback, navigateAfterFeedback, refetchDecisionLeads],
  );

  const sendMessage = async (input: string) => {
    if (!input.trim()) return;

    setAssistantSessionMessages((prev) => [...prev, { role: "user" as const, content: input }]);

    setLoading(true);

    try {
      const leads = await refetchDecisionLeads();
      const context: AssistantRequestContext = { leads };

      const structuredMessage = buildStructuredRecommendation(leads);
      if (structuredMessage) {
        applyAssistantMessageWithDedup(structuredMessage);
        setLoading(false);
        return { intent: "follow_up" };
      }

      const result = await generateActionPlan(input, activeLeadIdRef.current, context);
      const reply = result?.message || "No response generated";
      applyAssistantMessageWithDedup(reply);
    } catch (err) {
      console.error("[ASSISTANT ERROR]", err);
      applyAssistantMessageWithDedup("Request failed — try again.");
    }

    setLoading(false);
  };

  return {
    messages,
    loading,
    actionBusy,
    sendMessage,
    executeAction,
  } as UseAssistantResult;
}
