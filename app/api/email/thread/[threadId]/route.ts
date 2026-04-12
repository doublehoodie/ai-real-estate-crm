import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import {
  classifyMailboxDirection,
  extractEmailAddress,
  getHeaderValue,
  getPlainTextFromMessage,
  getReceivedAt,
} from "@/lib/email";
import type { ThreadMessageDetail } from "@/types/inbox";

type RouteParams = { params: Promise<{ threadId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing thread id" }, { status: 400 });
    }

    const { supabase, userId } = await requireAuthUserId();

    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: "Gmail integration not found" }, { status: 404 });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: integration.access_token as string | undefined,
      refresh_token: integration.refresh_token as string | undefined,
      expiry_date:
        integration.expiry_date != null ? Number(integration.expiry_date) : undefined,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const mailboxEmail = extractEmailAddress(profile.data.emailAddress ?? "");

    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = threadRes.data.messages ?? [];
    const details: ThreadMessageDetail[] = [];

    for (const m of messages) {
      if (!m.id) continue;
      const headers = m.payload?.headers ?? [];
      const from = getHeaderValue(headers, "from");
      const to = getHeaderValue(headers, "to");
      const subject = getHeaderValue(headers, "subject");
      const fromEmail = extractEmailAddress(from);
      const toEmail = extractEmailAddress(to);
      const direction = classifyMailboxDirection(fromEmail, toEmail, mailboxEmail);

      details.push({
        message_id: m.id,
        thread_id: m.threadId ?? threadId,
        from_email: fromEmail || null,
        to_email: toEmail || null,
        subject: subject || "(No subject)",
        received_at: getReceivedAt(headers),
        snippet: m.snippet ?? "",
        body_text: getPlainTextFromMessage(m),
        direction,
      });
    }

    details.sort(
      (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
    );

    return NextResponse.json({ messages: details, mailboxEmail });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
  }
}
