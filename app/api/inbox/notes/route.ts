import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { requireOptionalLeadId } from "@/lib/ids";

type Body = {
  threadId?: string;
  leadId?: string | null;
  note?: string;
  body?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    console.log("user_id:", userId);

    const payload = (await request.json()) as Body;
    const threadId = payload.threadId?.trim() || null;
    // Request JSON may use `note` or `body` as the text field (not the DB column).
    const content = (payload.note ?? payload.body)?.trim();

    if (!content) {
      return NextResponse.json({ error: "note is required" }, { status: 400 });
    }

    let leadId: string | null;
    try {
      leadId = requireOptionalLeadId(payload.leadId?.trim() || null);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid leadId" },
        { status: 400 },
      );
    }

    if (!threadId && !leadId) {
      return NextResponse.json({ error: "threadId or leadId is required" }, { status: 400 });
    }

    if (threadId && !leadId) {
      const { data: row } = await supabase
        .from("emails")
        .select("lead_id")
        .eq("user_id", userId)
        .eq("thread_id", threadId)
        .not("lead_id", "is", null)
        .limit(1)
        .maybeSingle();
      try {
        leadId = requireOptionalLeadId(row?.lead_id ?? null);
      } catch {
        return NextResponse.json(
          { error: "Thread is linked to an invalid lead_id in the database" },
          { status: 500 },
        );
      }
    }

    console.log("lead_id:", leadId);
    console.log("Saving note:", { content });

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        thread_id: threadId,
        lead_id: leadId,
        content,
      })
      .select("id, thread_id, lead_id, content, created_at")
      .single();

    if (error) {
      console.error("Note insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      note: data
        ? {
            ...data,
            note: data.content,
          }
        : data,
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}
