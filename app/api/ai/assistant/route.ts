import { NextResponse } from "next/server";
import { buildAssistantContext } from "@/lib/ai/buildAssistantContext";
import { generateActionPlan } from "@/lib/ai/generateActionPlan";
import type { LeadWithAssistantMessages } from "@/lib/ai/actionPlanTypes";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import type { Lead } from "@/types/lead";

type AssistantRequestBody = {
  userInput?: string;
  leadId?: string;
  context?: {
    leads?: Array<{
      id?: string;
      name?: string | null;
      ai_score?: number | null;
      lastContactDate?: string | null;
      lastActivityType?: string | null;
      status?: string | null;
    }>;
  };
};

type EmailPreviewRow = {
  received_at: string | null;
  snippet: string | null;
};

type CalendarEventRow = {
  title: string | null;
  start_time: string | null;
};

type LeadContextRow = {
  id: string;
  name: string | null;
  ai_score: number | null;
  last_contact_at?: string | null;
  status: string | null;
  ai_next_action?: { action?: string } | null;
  updated_at: string | null;
};

type StructuredLeadContext = {
  id: string;
  name: string | null;
  ai_score: number | null;
  lastContactDate: string | null;
  lastActivityType: string | null;
  status: string | null;
};

const ASSISTANT_LEAD_SELECT =
  "id, user_id, name, email, phone, budget, timeline, " +
  "status, notes, ai_summary, ai_intent_level, ai_score, ai_score_breakdown, ai_confidence, ai_signals, " +
  "ai_next_action, ai_followup, has_contradictions, ai_processed, created_at, updated_at";

function getGeneralFallbackLead(): LeadWithAssistantMessages {
  return {
    id: "assistant-general-context",
    user_id: null,
    name: null,
    email: null,
    phone: null,
    budget: null,
    timeline: null,
    status: null,
    notes: null,
    ai_summary: "General workspace assistant context.",
    ai_intent_level: null,
    ai_score: null,
    ai_score_breakdown: null,
    ai_confidence: null,
    ai_signals: null,
    ai_next_action: null,
    ai_followup: null,
    has_contradictions: null,
    ai_processed: null,
    created_at: null,
    updated_at: null,
    assistantRecentMessages: [],
  };
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuthUserId();

    let body: AssistantRequestBody;
    try {
      body = (await request.json()) as AssistantRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userInput = typeof body.userInput === "string" ? body.userInput : "";
    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";

    if (!userInput.trim()) {
      return NextResponse.json({ error: "userInput is required" }, { status: 400 });
    }

    const { data: leadContextRows } = await supabase
      .from("leads")
      .select("id, name, ai_score, last_contact_at, status, ai_next_action, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    const leads: StructuredLeadContext[] = ((leadContextRows ?? []) as LeadContextRow[]).map((leadRow) => {
      const lastActivityType =
        leadRow.ai_next_action && typeof leadRow.ai_next_action === "object"
          ? leadRow.ai_next_action.action ?? null
          : null;

      return {
        id: leadRow.id,
        name: leadRow.name,
        ai_score: typeof leadRow.ai_score === "number" ? leadRow.ai_score : null,
        lastContactDate: leadRow.last_contact_at ?? leadRow.updated_at ?? null,
        lastActivityType,
        status: leadRow.status,
      };
    });

    let contextLead: LeadWithAssistantMessages = getGeneralFallbackLead();

    if (leadId) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select(ASSISTANT_LEAD_SELECT)
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (leadError) {
        console.error("[assistant] lead fetch:", leadError);
        return NextResponse.json({ error: "Failed to load lead context" }, { status: 400 });
      }

      if (!leadData) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      const { data: emailRows } = await supabase
        .from("emails")
        .select("received_at, snippet")
        .eq("user_id", userId)
        .eq("lead_id", leadId)
        .order("received_at", { ascending: false })
        .limit(2);

      const { data: calendarRows } = await supabase
        .from("calendar_events")
        .select("title, start_time")
        .eq("user_id", userId)
        .eq("lead_id", leadId)
        .order("start_time", { ascending: false })
        .limit(2);

      const assistantRecentMessages = ((emailRows ?? []) as EmailPreviewRow[])
        .filter((r) => Boolean(r.received_at))
        .map((r) => ({
          received_at: r.received_at as string,
          preview: (r.snippet ?? "").trim(),
        }));

      const recentCalendarSummary = ((calendarRows ?? []) as CalendarEventRow[])
        .filter((r) => Boolean(r.start_time))
        .map((r) => `${r.title ?? "Event"} at ${new Date(r.start_time as string).toLocaleString()}`)
        .join(" | ");

      const leadWithContext = leadData as unknown as Lead;
      contextLead = {
        ...leadWithContext,
        ai_summary: [leadWithContext.ai_summary, recentCalendarSummary].filter(Boolean).join(" | "),
        assistantRecentMessages,
      };
    }

    const requestLeads = Array.isArray(body.context?.leads) ? body.context?.leads : [];
    const context = {
      ...buildAssistantContext(contextLead),
      leads: requestLeads.length > 0 ? requestLeads : leads,
    };
    console.log("Assistant Context:", context);
    const plan = await generateActionPlan(context, userInput);

    return NextResponse.json(plan);
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error("[assistant] route error", error);
    return NextResponse.json({ error: "Failed to generate assistant response" }, { status: 500 });
  }
}
