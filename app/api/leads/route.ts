import { NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";

const ACTION_WINDOW_SELECT =
  "id, name, email, status, ai_score, ai_confidence, ai_summary, ai_next_action, ai_followup, " +
  "ai_signals, has_contradictions, ai_score_breakdown, ai_intent_level, ai_processed, " +
  "last_contact_at, updated_at";

/**
 * GET — list leads for the signed-in user (AI fields for action window / prioritization).
 */
export async function GET(req: Request) {
  try {
    const requestAny = req as unknown as { query?: unknown; body?: unknown };
    console.log("Incoming request:", requestAny.query, requestAny.body);

    const { supabase, userId } = await requireAuthUserId();

    const { data, error } = await supabase
      .from("leads")
      .select(ACTION_WINDOW_SELECT)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("GET /api/leads:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}
