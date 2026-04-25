import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Newest email row timestamp for this lead (for staleness checks).
 */
export async function getLatestEmailReceivedAt(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("emails")
    .select("received_at")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[aiEmailFreshness] latest email ts:", error.message);
    return null;
  }
  return data?.received_at ?? null;
}

function pickBody(body: unknown, snippet: unknown): string {
  const b = typeof body === "string" ? body.trim() : "";
  if (b.length > 0) return b;
  return typeof snippet === "string" ? snippet.trim() : "";
}

/**
 * Text of all emails strictly after `afterIso` (for keyword-based recompute hints).
 */
export async function getConcatenatedEmailTextAfter(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  afterIso: string | null,
): Promise<string> {
  let q = supabase
    .from("emails")
    .select("body, snippet, received_at")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: true });

  if (afterIso) {
    q = q.gt("received_at", afterIso);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[aiEmailFreshness] delta text:", error.message);
    return "";
  }

  return (data ?? [])
    .map((r) => pickBody(r.body, r.snippet))
    .filter(Boolean)
    .join("\n");
}

/** Budget / timeline / urgency style signals in newly arrived text */
const QUAL_DELTA_HINT =
  /\b(budget|timeline|urgent|urgency|asap|closing|pre-?approved|prequalified|offer|looking to (buy|sell)|\$\s*[\d,]+|million|pre-?approval)\b/i;

export function deltaTextSuggestsQualificationSignals(text: string): boolean {
  const t = text.trim();
  return t.length >= 25 && QUAL_DELTA_HINT.test(t);
}

/**
 * Whether to run (or re-run) AI for this lead.
 * When ai_processed is true, re-run only if there is newer email activity than last AI run,
 * or optional keyword signals in new delta text.
 */
export function shouldRecomputeAiForLead(
  aiProcessed: boolean | null | undefined,
  aiLastProcessedAt: string | null | undefined,
  latestEmailReceivedAt: string | null,
  newEmailsDeltaText: string,
  /** When no DB emails exist, allow /api/ai/process-lead or sync hint to force a run */
  hintFromCallerLength: number,
): boolean {
  if (!aiProcessed) return true;

  if (!latestEmailReceivedAt) {
    return hintFromCallerLength >= 20;
  }

  if (!aiLastProcessedAt) {
    return true;
  }

  const latest = new Date(latestEmailReceivedAt).getTime();
  const last = new Date(aiLastProcessedAt).getTime();
  if (latest > last) {
    return true;
  }

  if (deltaTextSuggestsQualificationSignals(newEmailsDeltaText)) {
    return true;
  }

  return false;
}
