import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid } from "@/lib/ids";

/** Status values the assistant execution loop may set via PATCH. */
const ALLOWED_STATUS = new Set(["contacted", "meeting_scheduled"]);

type PatchBody = {
  status?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.status !== "string" || !ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "status must be contacted or meeting_scheduled" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("leads")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("PATCH /api/leads/[id]:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead: data });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}
