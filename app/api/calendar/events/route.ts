import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid } from "@/lib/ids";
import type { CalendarEventType, CalendarEventUrgency } from "@/types/calendar";
import { buildCleanEventNotes } from "@/lib/calendar/buildCleanEventNotes";
import { getEventsForUser } from "@/lib/calendar/getEventsForUser";

function parseIso(s: string | null): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const { searchParams } = new URL(request.url);
    const from = parseIso(searchParams.get("from"));
    const to = parseIso(searchParams.get("to"));
    if (!from || !to) {
      return NextResponse.json({ error: "from and to (ISO date/datetime) are required" }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: "from must be before to" }, { status: 400 });
    }

    const leadIdRaw = searchParams.get("leadId")?.trim();
    if (leadIdRaw && !isUuid(leadIdRaw)) {
      return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
    }

    const events = await getEventsForUser(
      supabase,
      userId,
      { from, to },
      leadIdRaw ? { leadId: leadIdRaw } : undefined,
    );
    console.log("[EVENT READ]", { count: events.length, leadId: leadIdRaw ?? null });
    return NextResponse.json({ events });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

const EVENT_TYPES = new Set<CalendarEventType>(["call", "follow_up", "tour", "meeting"]);
const URGENCY = new Set<CalendarEventUrgency>(["low", "medium", "high"]);

type PostBody = {
  leadId?: string;
  type?: CalendarEventType;
  title?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  urgencyLevel?: CalendarEventUrgency;
  aiGenerated?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    const body = (await request.json()) as PostBody;
    const leadId = body.leadId?.trim();
    if (!leadId || !isUuid(leadId)) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }
    const type = body.type;
    if (!type || !EVENT_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const start = parseIso(body.startTime ?? null);
    const end = parseIso(body.endTime ?? null);
    if (!start || !end) {
      return NextResponse.json({ error: "startTime and endTime are required (ISO)" }, { status: 400 });
    }
    if (end < start) {
      return NextResponse.json({ error: "endTime must be on or after startTime" }, { status: 400 });
    }
    const urgency = body.urgencyLevel ?? "medium";
    if (!URGENCY.has(urgency)) {
      return NextResponse.json({ error: "Invalid urgencyLevel" }, { status: 400 });
    }

    const { data: leadRow, error: leadErr } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (leadErr || !leadRow) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const description = buildCleanEventNotes(body.description);
    const location = body.location?.trim() || "Virtual (Google Meet)";
    const ai_generated = Boolean(body.aiGenerated);

    if (location === "Google Meet" || location === "Virtual (Google Meet)") {
      // later: generate meeting link
    }

    const payload = {
      user_id: userId,
      lead_id: leadId,
      type,
      title,
      description,
      location,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      urgency_level: urgency,
      ai_generated,
      status: "scheduled" as const,
    };
    console.log("[EVENT CREATE]", { lead_id: leadId, type, title, start: payload.start_time, end: payload.end_time });

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select("*, leads(name, email)")
      .single();

    if (error) {
      console.error("calendar_events insert:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
