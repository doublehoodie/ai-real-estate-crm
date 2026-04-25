import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid } from "@/lib/ids";
import type { CalendarEventStatus } from "@/types/calendar";
import { buildCleanEventNotes } from "@/lib/calendar/buildCleanEventNotes";

const STATUSES = new Set<CalendarEventStatus>(["scheduled", "completed", "missed"]);

type PatchBody = {
  status?: CalendarEventStatus;
  start_time?: string;
  end_time?: string;
  location?: string;
  description?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = (await request.json()) as PatchBody;
    const hasStatus = Boolean(body.status);
    const hasTime = typeof body.start_time === "string" || typeof body.end_time === "string";
    const hasLocation = typeof body.location === "string";
    const hasDescription = typeof body.description === "string";
    if (!hasStatus && !hasTime && !hasLocation && !hasDescription) {
      return NextResponse.json(
        { error: "status, time, location, or description fields are required" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (hasStatus) {
      if (!body.status || !STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.start_time !== undefined) {
      const d = new Date(body.start_time);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid start_time" }, { status: 400 });
      }
      updates.start_time = d.toISOString();
    }
    if (body.end_time !== undefined) {
      const d = new Date(body.end_time);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid end_time" }, { status: 400 });
      }
      updates.end_time = d.toISOString();
    }
    if (typeof body.location === "string") {
      updates.location = body.location.trim() || "Virtual (Google Meet)";
    }
    if (typeof body.description === "string") {
      updates.description = buildCleanEventNotes(body.description);
    }
    console.log("[EVENT UPDATE]", { id, keys: Object.keys(updates) });
    if (
      typeof updates.start_time === "string" &&
      typeof updates.end_time === "string" &&
      new Date(updates.end_time).getTime() <= new Date(updates.start_time).getTime()
    ) {
      return NextResponse.json({ error: "end_time must be after start_time" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, leads(name, email)")
      .maybeSingle();

    if (error) {
      console.error("calendar_events patch:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    console.log("[EVENT DELETE]", id);
    const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      console.error("calendar_events delete:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
