import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import {
  classifyMailboxDirection,
  extractEmailAddress,
  getEmailBodyFromMessage,
  getHeaderValue,
  getReceivedAt,
} from "@/lib/email";
import { loadInboxThreadsForUser } from "@/lib/inbox/loadInboxFromDb";
import { matchLeadIdForAddresses } from "@/lib/inbox/matchLead";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";

/**
 * Gmail sync: fetches from Gmail API, upserts into emails, then returns DB-backed threads.
 */
export async function POST() {
  try {
    const { supabase, userId } = await requireAuthUserId();

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
    const profile = await gmail.users.getProfile({ userId: "me" });
    const mailboxEmail = extractEmailAddress(profile.data.emailAddress ?? "");

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 40,
    });

    const list = listRes.data.messages ?? [];
    console.log("[POST /api/email/sync] Fetched messages from Gmail:", list.length);

    let insertSuccessCount = 0;
    let insertErrorCount = 0;
    let fallbackInsertCount = 0;

    for (const messageRef of list) {
      if (!messageRef.id) continue;

      const messageRes = await gmail.users.messages.get({
        userId: "me",
        id: messageRef.id,
        format: "full",
      });

      const message = messageRes.data;
      const headers = message.payload?.headers ?? [];
      const from = getHeaderValue(headers, "from");
      const to = getHeaderValue(headers, "to");
      const subject = getHeaderValue(headers, "subject");
      const fromEmail = extractEmailAddress(from);
      const toEmail = extractEmailAddress(to);
      const direction = classifyMailboxDirection(fromEmail, toEmail, mailboxEmail);
      const leadId = await matchLeadIdForAddresses(supabase, userId, fromEmail, toEmail);
      const body = getEmailBodyFromMessage(message);

      const row = {
        user_id: userId,
        provider: "gmail",
        message_id: message.id ?? null,
        thread_id: message.threadId ?? null,
        from_email: fromEmail || null,
        to_email: toEmail || null,
        subject: subject || "(No subject)",
        snippet: message.snippet ?? "",
        body,
        received_at: getReceivedAt(headers),
        lead_id: leadId,
        direction,
      };

      console.log("Upserting email with keys:", {
        user_id: userId,
        thread_id: row.thread_id,
      });

      const { error: insertError } = await supabase.from("emails").upsert(row, {
        onConflict: "user_id,thread_id",
      });

      if (insertError) {
        const msg = insertError.message?.toLowerCase() ?? "";
        const directionMissing = msg.includes("direction") && msg.includes("column");
        if (directionMissing) {
          const fallbackRow = {
            user_id: row.user_id,
            provider: row.provider,
            message_id: row.message_id,
            thread_id: row.thread_id,
            from_email: row.from_email,
            to_email: row.to_email,
            subject: row.subject,
            snippet: row.snippet,
            body: row.body,
            received_at: row.received_at,
            lead_id: row.lead_id,
          };
          console.log("Upserting email with keys:", {
            user_id: fallbackRow.user_id,
            thread_id: fallbackRow.thread_id,
          });
          const { error: fallbackError } = await supabase.from("emails").upsert(fallbackRow, {
            onConflict: "user_id,thread_id",
          });
          if (fallbackError) {
            insertErrorCount += 1;
            console.error("Email upsert error:", fallbackError);
          } else {
            fallbackInsertCount += 1;
          }
        } else {
          insertErrorCount += 1;
          console.error("Email upsert error:", insertError);
        }
      } else {
        insertSuccessCount += 1;
      }
    }

    console.log("[POST /api/email/sync] insert summary:", {
      insertSuccessCount,
      fallbackInsertCount,
      insertErrorCount,
    });

    const { threads } = await loadInboxThreadsForUser(supabase, userId);

    return NextResponse.json({
      success: true,
      mailboxEmail,
      threads,
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to sync inbox" }, { status: 500 });
  }
}
