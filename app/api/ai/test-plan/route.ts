import { NextResponse } from "next/server";
import { buildAssistantContext } from "@/lib/ai/buildAssistantContext";
import { generateActionPlan } from "@/lib/ai/generateActionPlan";
import type { LeadWithAssistantMessages } from "@/lib/ai/actionPlanTypes";

/** Hardcoded mock lead for exercising `generateActionPlan` from the browser. */
const MOCK_LEAD: LeadWithAssistantMessages = {
  id: "00000000-0000-4000-8000-000000000099",
  name: "Test Buyer",
  email: "buyer@example.com",
  phone: null,
  budget: "$750k–$900k",
  timeline: "45–60 days",
  status: "active",
  notes: null,
  ai_summary: "Interested in townhomes near transit; requested a pricing sheet and second walkthrough.",
  ai_score: 72,
  ai_intent_level: "medium",
  ai_score_breakdown: { budget: 18, timeline: 16, intent: 20, urgency: 18 },
  has_contradictions: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  assistantRecentMessages: [
    {
      received_at: new Date(Date.now() - 3600000).toISOString(),
      preview: "Can we compare HOA fees for the two listings you sent?",
    },
  ],
};

type PostBody = {
  userInput?: string;
};

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userInput = typeof body.userInput === "string" ? body.userInput : "";
  if (!userInput.trim()) {
    return NextResponse.json({ error: "userInput is required" }, { status: 400 });
  }

  console.log("[TEST PLAN API INPUT]", userInput);

  const context = buildAssistantContext(MOCK_LEAD);
  const plan = await generateActionPlan(context, userInput);

  console.log("[TEST PLAN API OUTPUT]", plan);

  return NextResponse.json(plan);
}
