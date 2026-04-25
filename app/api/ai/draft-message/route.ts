import { NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid } from "@/lib/ids";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4.1-mini";

const LEAD_SELECT =
  "id, user_id, name, email, phone, budget, timeline, status, notes, ai_summary, ai_score, ai_followup, last_contact_at";

type DraftBody = {
  leadId?: string;
};

async function generateDraftText(args: {
  apiKey: string;
  lead: {
    name: string | null;
    email: string | null;
    ai_summary: string | null;
    ai_followup: string | null;
    notes: string | null;
  };
}): Promise<string> {
  const system =
    "You write short, professional follow-up emails for a real estate agent. Output plain text only — no subject line, no greeting placeholder like [Name] unless the lead's first name is known. One compact paragraph or two short paragraphs max.";

  const userPayload = {
    leadName: args.lead.name,
    leadEmail: args.lead.email,
    aiSummary: args.lead.ai_summary,
    existingSuggestedFollowup: args.lead.ai_followup,
    notes: args.lead.notes,
  };

  const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Draft a follow-up message to this lead as the agent.\n\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || `OpenAI error (${res.status})`);
  }

  const text = raw.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty draft from model");
  return text;
}

function fallbackDraft(lead: { name: string | null; ai_followup: string | null }): string {
  const suggested = lead.ai_followup?.trim();
  if (suggested) return suggested;
  const first = lead.name?.split(/\s+/)[0]?.trim() || "there";
  return `Hi ${first},\n\nI wanted to follow up and see if you had any questions. What time works best for a quick call this week?\n\nThanks`;
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuthUserId();

    let body: DraftBody;
    try {
      body = (await request.json()) as DraftBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    if (!leadId || !isUuid(leadId)) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const { data: lead, error: loadError } = await supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadError) {
      console.error("[draft-message] load:", loadError);
      return NextResponse.json({ error: loadError.message }, { status: 400 });
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const row = lead as {
      name: string | null;
      email: string | null;
      ai_summary: string | null;
      ai_followup: string | null;
      notes: string | null;
    };

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    let message: string;
    try {
      if (apiKey) {
        message = await generateDraftText({ apiKey, lead: row });
      } else {
        message = fallbackDraft(row);
      }
    } catch (e) {
      console.warn("[draft-message] AI failed, using fallback:", e);
      message = fallbackDraft(row);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        last_contact_at: now,
        status: "contacted",
        updated_at: now,
      })
      .eq("id", leadId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[draft-message] update:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      message,
      leadId,
      leadName: (row.name ?? "Untitled lead").trim() || "Untitled lead",
      email: row.email?.trim() ?? "",
      aiSummary: row.ai_summary?.trim() ?? "",
      notes: row.notes?.trim() ?? "",
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error("[draft-message]", error);
    return NextResponse.json({ error: "Failed to draft message" }, { status: 500 });
  }
}
