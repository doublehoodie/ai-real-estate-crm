/**
 * Manual smoke tests for the AI planning layer.
 * Run: npm run action-plan-smoke
 * Requires OPENAI_API_KEY (e.g. in .env.local) for real model output; otherwise plans fall back safely.
 */

import fs from "fs";
import path from "path";
import { buildAssistantContext } from "../lib/ai/buildAssistantContext";
import { generateActionPlan } from "../lib/ai/generateActionPlan";
import type { LeadWithAssistantMessages } from "../lib/ai/actionPlanTypes";

function loadEnvLocal(): void {
  try {
    const p = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(p)) return;
    const s = fs.readFileSync(p, "utf8");
    for (const line of s.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

const mockLead: LeadWithAssistantMessages = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Alex Buyer",
  email: "alex@example.com",
  phone: null,
  budget: "$800k–$1M",
  timeline: "60–90 days",
  status: "active",
  notes: null,
  ai_summary: "Pre-approved buyer exploring downtown condos; asked for a second showing.",
  ai_score: 78,
  ai_intent_level: "high",
  ai_score_breakdown: { budget: 20, timeline: 18, intent: 22, urgency: 18 },
  has_contradictions: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  assistantRecentMessages: [
    {
      received_at: new Date(Date.now() - 86400000).toISOString(),
      preview: "Thanks — can we tour the Riverline unit again this weekend?",
    },
    {
      received_at: new Date(Date.now() - 172800000).toISOString(),
      preview: "Sent lender letter; still comparing two buildings.",
    },
  ],
};

async function main() {
  loadEnvLocal();
  const context = buildAssistantContext(mockLead);

  const cases = ["follow up", "schedule something", "what should I do"] as const;

  for (const q of cases) {
    console.log("\n==========\nCASE:", JSON.stringify(q), "\n==========");
    await generateActionPlan(context, q);
  }
}

void main();
