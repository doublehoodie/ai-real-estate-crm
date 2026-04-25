"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { isUuid } from "@/lib/ids";
import type { AssistantMessageContent, ExecuteActionPayload } from "@/lib/ai/assistantSurfaceTypes";
export type {
  AssistantExecutableAction,
  AssistantStep,
  AssistantActionRecommendation,
  AssistantMessageContent,
  ExecuteActionPayload,
  SeedAction,
  SeedStructuredResponse,
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

type SeedIntent = "meetings" | "cold_analysis" | "top_leads" | "strategy" | "default";

type SeedLead = {
  id: string;
  name: string;
  ai_score: number;
  status: string | null;
  last_contact_at: string | null;
  timeline: string | null;
  budget: string | null;
};

type SeedEvent = {
  id: string;
  lead_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  leads?: { name: string | null; email: string | null } | null;
};

type SeedContext = {
  leads: SeedLead[];
  events: SeedEvent[];
};

function assistantFingerprint(content: AssistantMessageContent): string {
  if (typeof content === "string") return content;
  if (content.type === "action_recommendation") {
    return `${content.type}:${content.title}:${content.subtitle}`;
  }
  if (content.type === "seed_response") {
    const actions = (content.actions ?? []).map((a) => `${a.type}:${a.label}:${a.leadId ?? ""}`).join("|");
    return `${content.type}:${content.text}:${actions}`;
  }
  return "unknown";
}

function getIntent(message: string): SeedIntent {
  const m = message.toLowerCase();
  if (m.includes("meeting")) return "meetings";
  if (m.includes("cold")) return "cold_analysis";
  if (m.includes("convert") || m.includes("best")) return "top_leads";
  if (m.includes("what should i do")) return "strategy";
  return "default";
}

function formatLastContact(lastContactDate: string | null): string {
  if (!lastContactDate) return "unknown date";
  const d = new Date(lastContactDate);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown time";
  return d.toLocaleString();
}

function isStale(lead: SeedLead): boolean {
  if (!lead.last_contact_at) return true;
  const last = new Date(lead.last_contact_at);
  if (Number.isNaN(last.getTime())) return true;
  const ageMs = Date.now() - last.getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 14;
}

function getLeadStats(leads: SeedLead[]) {
  return {
    total: leads.length,
    hot: leads.filter((l) => l.ai_score >= 70),
    warm: leads.filter((l) => l.ai_score >= 40 && l.ai_score < 70),
    cold: leads.filter((l) => l.ai_score < 40),
  };
}

function getUpcomingMeetings(events: SeedEvent[]): SeedEvent[] {
  const now = new Date();
  return events
    .filter((e) => new Date(e.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

function getTopLeads(leads: SeedLead[]): SeedLead[] {
  return [...leads].sort((a, b) => b.ai_score - a.ai_score).slice(0, 3);
}

function dedupeActions(
  actions: Array<{ label: string; type: "follow_up" | "schedule" | "view_lead" | "reengage"; leadId?: string }>,
) {
  const seen = new Set<string>();
  const out: typeof actions = [];
  for (const action of actions) {
    const key = `${action.type}:${action.leadId ?? ""}:${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
    if (out.length >= 3) break;
  }
  return out;
}

function generateMeetingResponse(events: SeedEvent[]) {
  const upcoming = getUpcomingMeetings(events);
  if (upcoming.length === 0) {
    return {
      type: "seed_response" as const,
      text: "You don't have any upcoming meetings.",
      actions: [],
    };
  }

  const lines = upcoming
    .slice(0, 3)
    .map((e) => `- ${e.leads?.name?.trim() || e.title || "Untitled lead"} on ${formatDateTime(e.start_time)}`);
  const text = [`You have ${upcoming.length} upcoming meetings:`, ...lines].join("\n");
  return {
    type: "seed_response" as const,
    text,
    actions: dedupeActions(
      upcoming.slice(0, 3).map((e) => ({
        label: "View lead",
        type: "view_lead" as const,
        leadId: e.lead_id,
      })),
    ),
  };
}

function generateColdAnalysis(leads: SeedLead[]) {
  const stats = getLeadStats(leads);
  const staleCold = stats.cold.filter((l) => isStale(l));
  const picks = staleCold.length > 0 ? staleCold.slice(0, 3) : stats.cold.slice(0, 3);
  const text = [
    `You have ${stats.cold.length} cold leads.`,
    `${staleCold.length} have not been contacted recently.`,
    "",
    "Recommended:",
    "- Re-engage top 3",
    "- Drop lowest quality leads",
  ].join("\n");
  return {
    type: "seed_response" as const,
    text,
    actions: dedupeActions(
      picks.map((lead) => ({
        label: `Re-engage ${lead.name}`,
        type: "reengage" as const,
        leadId: lead.id,
      })),
    ),
  };
}

function generateTopLeadsResponse(leads: SeedLead[]) {
  const top = getTopLeads(leads);
  if (top.length === 0) {
    return {
      type: "seed_response" as const,
      text: "No leads available yet. Import leads to generate top conversion priorities.",
      actions: [],
    };
  }
  const text = [
    "Best leads to convert right now:",
    ...top.map(
      (lead, idx) =>
        `${idx + 1}. ${lead.name} (score ${Math.round(lead.ai_score)}, status ${lead.status ?? "unknown"}, last contact ${formatLastContact(lead.last_contact_at)})`,
    ),
  ].join("\n");
  return {
    type: "seed_response" as const,
    text,
    actions: dedupeActions([
      { label: "Follow up top", type: "follow_up", leadId: top[0].id },
      { label: "Schedule top", type: "schedule", leadId: top[0].id },
      { label: "View top lead", type: "view_lead", leadId: top[0].id },
    ]),
  };
}

function generateStrategy(leads: SeedLead[]) {
  const stats = getLeadStats(leads);
  const top = getTopLeads(leads);
  const topLead = top[0];
  if (!topLead) {
    return {
      type: "seed_response" as const,
      text: "You have no leads yet. Start by importing leads or adding one manually.",
      actions: [],
    };
  }
  const text = [
    `Overview: ${stats.hot.length} hot, ${stats.warm.length} warm, ${stats.cold.length} cold.`,
    "",
    `Top priority: ${topLead.name}.`,
    "",
    "Next actions:",
    "1. Follow up hot leads",
    "2. Schedule 1-2 meetings",
    "3. Re-engage cold leads",
  ].join("\n");
  return {
    type: "seed_response" as const,
    text,
    actions: dedupeActions([
      { label: "Follow up top", type: "follow_up", leadId: topLead.id },
      { label: "Schedule meeting", type: "schedule", leadId: topLead.id },
      {
        label: stats.cold[0] ? `Re-engage ${stats.cold[0].name}` : "View leads",
        type: stats.cold[0] ? "reengage" : "view_lead",
        leadId: stats.cold[0]?.id,
      },
    ]),
  };
}

function expandResponse(response: string): string {
  return `${response}\n\nIf you want, I can break this into a 3-step action plan.`;
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

export function useAssistant(_leadId?: string) {
  const router = useRouter();
  const messages = useAssistantSessionMessages();
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  function applyAssistantMessageWithDedup(newContent: AssistantMessageContent) {
    setAssistantSessionMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && assistantFingerprint(last.content) === assistantFingerprint(newContent)) {
        if (typeof newContent === "string") {
          const expanded = expandResponse(newContent);
          if (expanded !== newContent) {
            const next = [...prev];
            next[prev.length - 1] = { role: "assistant", content: expanded };
            return next;
          }
        }
        return prev;
      }

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

  const getAllLeads = useCallback(async (): Promise<SeedLead[]> => {
    const leadsRes = await fetch("/api/leads", { credentials: "include" });
    const leadsPayload = (await leadsRes.json().catch(() => ({}))) as {
      leads?: Array<{
        id?: string;
        name?: string | null;
        ai_score?: number | null;
        status?: string | null;
        last_contact_at?: string | null;
        timeline?: string | null;
        budget?: string | null;
      }>;
    };
    return (leadsPayload.leads ?? [])
      .filter((lead) => typeof lead.id === "string")
      .map((lead) => ({
        id: lead.id as string,
        name: (lead.name ?? "Untitled lead").trim() || "Untitled lead",
        ai_score: typeof lead.ai_score === "number" ? lead.ai_score : 0,
        status: lead.status ?? null,
        last_contact_at: lead.last_contact_at ?? null,
        timeline: lead.timeline ?? null,
        budget: lead.budget ?? null,
      }));
  }, []);

  const getAllEvents = useCallback(async (): Promise<SeedEvent[]> => {
    const from = new Date("1970-01-01T00:00:00.000Z");
    const to = new Date("2100-01-01T00:00:00.000Z");
    const qs = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const res = await fetch(`/api/calendar/events?${qs.toString()}`, {
      credentials: "include",
    });
    const payload = (await res.json().catch(() => ({}))) as { events?: SeedEvent[] };
    return payload.events ?? [];
  }, []);

  const getSeedContext = useCallback(async (_userId?: string): Promise<SeedContext> => {
    const [leads, events] = await Promise.all([getAllLeads(), getAllEvents()]);
    return { leads, events };
  }, [getAllLeads, getAllEvents]);

  const handleSeed = useCallback(async (message: string, userId?: string) => {
    const context = await getSeedContext(userId);
    const intent = getIntent(message);

    switch (intent) {
      case "meetings":
        return generateMeetingResponse(context.events);
      case "cold_analysis":
        return generateColdAnalysis(context.leads);
      case "top_leads":
        return generateTopLeadsResponse(context.leads);
      case "strategy":
        return generateStrategy(context.leads);
      default:
        return generateStrategy(context.leads);
    }
  }, [getSeedContext]);

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
      const deterministicReply = await handleSeed(input);
      applyAssistantMessageWithDedup(deterministicReply);
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
