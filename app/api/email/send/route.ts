import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { toBase64Url } from "@/lib/email";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";

type SendEmailBody = {
  to: string;
  subject: string;
  body: string;
  /** Gmail thread id — keeps message in the same conversation */
  threadId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();

    const { to, subject, body, threadId } = (await request.json()) as SendEmailBody;
    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "Missing to, subject, or body" },
        { status: 400 },
      );
    }

    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (integrationError || !integration) {
      console.error(integrationError);
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
    const rawMessage = [
      `To: ${to}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${subject}`,
      "",
      body,
    ].join("\n");

    const encodedMessage = toBase64Url(rawMessage);

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        ...(threadId ? { threadId } : {}),
      },
    });

    return NextResponse.json({ success: true, messageId: result.data.id });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
