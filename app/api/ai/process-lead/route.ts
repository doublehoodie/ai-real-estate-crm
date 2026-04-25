import { NextRequest, NextResponse } from "next/server";
import { hasHardSpamSignals } from "@/lib/ai/nonLeadEmailFilter";
import { processLeadQualificationWithAI } from "@/lib/ai/leadQualification";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid } from "@/lib/ids";

type ProcessLeadBody = {
  email_body?: string;
  lead_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const body = (await request.json()) as ProcessLeadBody;

    const leadId = body.lead_id?.trim();
    const emailBody = body.email_body?.trim();

    if (!leadId || !isUuid(leadId)) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
    }

    if (!emailBody) {
      return NextResponse.json({ error: "email_body is required" }, { status: 400 });
    }

    const shouldRunAI = emailBody && emailBody.length > 20;

    if (!shouldRunAI) {
      return NextResponse.json({ status: "skipped", leadId, reason: "empty_body" }, { status: 200 });
    }

    if (hasHardSpamSignals(emailBody)) {
      return NextResponse.json({ status: "skipped", leadId, reason: "hard_spam" }, { status: 200 });
    }

    const result = await processLeadQualificationWithAI({
      supabase,
      userId,
      leadId,
      emailBody,
    });

    return NextResponse.json(result);
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    console.error("[api/ai/process-lead] failed:", error);
    return NextResponse.json(
      { status: "skipped", reason: "ai_processing_failed" },
      { status: 200 },
    );
  }
}
