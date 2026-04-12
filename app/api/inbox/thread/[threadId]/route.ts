import { NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import type { EmailDirection, ThreadMessageDetail } from "@/types/inbox";

type RouteParams = { params: Promise<{ threadId: string }> };

type EmailRow = {
  message_id: string | null;
  thread_id: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  body?: string | null;
  received_at: string | null;
  direction: string | null;
};

/**
 * Thread messages from Supabase only (no Gmail API). Uses `emails.body` when present, else `snippet`.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing thread id" }, { status: 400 });
    }

    const { supabase, userId } = await requireAuthUserId();
    console.log("user_id:", userId);

    const primary = await supabase
      .from("emails")
      .select(
        "message_id, thread_id, from_email, to_email, subject, snippet, body, received_at, direction",
      )
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true });

    let rows: EmailRow[] | null = primary.data as EmailRow[] | null;
    if (primary.error) {
      const msg = primary.error.message?.toLowerCase() ?? "";
      const noBody = msg.includes("body") && msg.includes("column");
      if (!noBody) {
        console.error(primary.error);
        return NextResponse.json({ error: primary.error.message }, { status: 400 });
      }
      const legacy = await supabase
        .from("emails")
        .select("message_id, thread_id, from_email, to_email, subject, snippet, received_at, direction")
        .eq("user_id", userId)
        .eq("thread_id", threadId)
        .order("received_at", { ascending: true });
      if (legacy.error) {
        console.error(legacy.error);
        return NextResponse.json({ error: legacy.error.message }, { status: 400 });
      }
      rows = legacy.data as EmailRow[] | null;
    }

    const messages: ThreadMessageDetail[] = (rows ?? []).map((r) => {
      const snippet = r.snippet ?? "";
      const rawBody = r.body;
      const body_text = (typeof rawBody === "string" ? rawBody : "").trim() || snippet;
      return {
        message_id: r.message_id ?? "",
        thread_id: r.thread_id,
        from_email: r.from_email,
        to_email: r.to_email,
        subject: r.subject ?? "",
        received_at: r.received_at ?? "",
        snippet,
        body_text,
        direction: (r.direction as EmailDirection | null) ?? null,
      };
    });

    return NextResponse.json({ messages });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
  }
}
