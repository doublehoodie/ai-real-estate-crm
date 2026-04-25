import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processLeadQualificationWithAI,
  type ProcessLeadQualificationResult,
} from "@/lib/ai/leadQualification";
import { hasHardSpamSignals } from "@/lib/ai/nonLeadEmailFilter";
import { resolveEmailBodyForAi } from "@/lib/inbox/getBestEmailBodyForLead";

type TriggerOpts = {
  /** For logs only (e.g. gmail_sync, inbox_manual_link, post_reconcile_email_scan) */
  reason?: string;
};

/**
 * Single entry point for AI lead qualification triggers.
 * Validates body length, logs lead state, then delegates to `processLeadQualificationWithAI`.
 */
export async function triggerAiIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  leadId: string | null | undefined,
  emailBody: string | null | undefined,
  opts?: TriggerOpts,
): Promise<ProcessLeadQualificationResult | null> {
  const reason = opts?.reason ?? "unspecified";
  const id = typeof leadId === "string" ? leadId.trim() : "";
  if (!id) {
    console.log("[AI SKIP REASON]", {
      leadId: leadId ?? null,
      reason: "missing_lead_id",
      emailBodyLength: emailBody?.length ?? 0,
    });
    return null;
  }

  const hint = typeof emailBody === "string" ? emailBody : "";
  const resolved = await resolveEmailBodyForAi(supabase, userId, id, hint);
  const bodyForAi = resolved ?? "";

  if (!bodyForAi || bodyForAi.trim().length < 20) {
    console.log("[AI SKIP REASON]", {
      leadId: id,
      reason: "empty_body",
      emailBodyLength: bodyForAi?.length ?? 0,
    });
    console.log("[AI TRIGGER]", { leadId: id, phase: "skip", reason: "empty_body", triggerReason: reason });
    console.log("[AI TRIGGER CHECK]", {
      leadId: id,
      ai_processed: null,
      hasSummary: false,
      reason,
      skipped: "empty_body",
    });
    console.log("[AI trigger done]", {
      leadId: id,
      reason,
      status: "skipped",
      skipReason: "empty_body",
    });
    return { status: "skipped", leadId: id, reason: "empty_body" };
  }

  if (hasHardSpamSignals(bodyForAi)) {
    console.log("[AI SKIP REASON]", {
      leadId: id,
      reason: "hard_spam",
      emailBodyLength: bodyForAi.length,
    });
    console.log("[AI TRIGGER CHECK]", {
      leadId: id,
      ai_processed: null,
      hasSummary: false,
      reason,
      skipped: "hard_spam",
    });
    console.log("[AI trigger done]", {
      leadId: id,
      reason,
      status: "skipped",
      skipReason: "hard_spam",
    });
    return { status: "skipped", leadId: id, reason: "hard_spam" };
  }

  const { data: leadRow } = await supabase
    .from("leads")
    .select("id, ai_processed, ai_summary")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  console.log("[AI TRIGGER CHECK]", {
    leadId: id,
    ai_processed: leadRow?.ai_processed ?? null,
    hasSummary: Boolean(leadRow?.ai_summary?.trim()),
    reason,
  });

  console.log("[AI TRIGGER]", { leadId: id, phase: "run", triggerReason: reason });

  try {
    const result = await processLeadQualificationWithAI({
      supabase,
      userId,
      leadId: id,
      emailBody: bodyForAi,
    });
    console.log("[AI trigger done]", {
      leadId: id,
      reason,
      status: result.status,
      skipReason: result.status === "skipped" ? result.reason : undefined,
    });
    return result;
  } catch (error) {
    console.error("[AI trigger error]", { leadId: id, reason, error });
    throw error;
  }
}
