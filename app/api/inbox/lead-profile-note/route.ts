import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { requireLeadId } from "@/lib/ids";

type Body = {
  leadId: string;
  note: string;
};

/**
 * Mirrors CRM lead profile notes into `notes` (thread_id null) so inbox threads can show them when linked.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    console.log("user_id:", userId);

    const body = (await request.json()) as Body;
    let leadId: string;
    try {
      leadId = requireLeadId(body.leadId?.trim() ?? null);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "leadId must be a valid UUID" },
        { status: 400 },
      );
    }
    const note = body.note?.trim() ?? "";
    console.log("lead_id:", leadId);

    const { error: delError } = await supabase
      .from("notes")
      .delete()
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .is("thread_id", null);

    if (delError) {
      console.error("[lead-profile-note] delete mirror error:", delError);
      return NextResponse.json({ error: delError.message }, { status: 400 });
    }

    if (!note) {
      return NextResponse.json({ success: true, cleared: true });
    }

    const content = `CRM profile:\n${note}`;
    console.log("Saving note:", { content });

    const { data, error: insError } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        lead_id: leadId,
        thread_id: null,
        content,
      })
      .select("id, lead_id, content, created_at")
      .single();

    if (insError) {
      console.error("[lead-profile-note] insert mirror error:", insError);
      return NextResponse.json({ error: insError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      note: data ? { ...data, note: data.content } : data,
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to sync profile note" }, { status: 500 });
  }
}
