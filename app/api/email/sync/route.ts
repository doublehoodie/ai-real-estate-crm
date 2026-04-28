import { NextResponse } from "next/server";
import {
  classifyMailboxDirection,
  extractEmailAddress,
  getEmailBodyFromMessage,
  getHeaderValue,
  getReceivedAt,
} from "@/lib/email";
import { loadInboxThreadsForUser } from "@/lib/inbox/loadInboxFromDb";
import { matchLeadIdForAddresses } from "@/lib/inbox/matchLead";
import { reconcileEmailsToLeads } from "@/lib/inbox/reconcileEmailLeads";
import { runInboxAiCatchup } from "@/lib/inbox/runInboxAiCatchup";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { triggerAiIfNeeded } from "@/lib/ai/triggerAiIfNeeded";

/**
 * Gmail sync: fetches from Gmail API, upserts into emails, then returns DB-backed threads.
 */
export async function POST() {
  try {
    console.log("Running inbox sync...");
    console.log("🚀 SYNC ROUTE HIT");
    const { supabase, userId } = await requireAuthUserId();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log("SESSION:", session);
    console.log("PROVIDER TOKEN:", session?.provider_token);

    const accessToken = session?.provider_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing Gmail token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const profile = await gmailApiGet<{ emailAddress?: string }>(
      "/gmail/v1/users/me/profile",
      accessToken,
    );
    const mailboxEmail = extractEmailAddress(profile.emailAddress ?? "");

    const listRes = await gmailApiGet<{ messages?: Array<{ id?: string | null }> }>(
      "/gmail/v1/users/me/messages?maxResults=40",
      accessToken,
    );
    const list = listRes.messages ?? [];
    console.log("[POST /api/email/sync] Fetched messages from Gmail:", list.length);

    let insertSuccessCount = 0;
    let insertErrorCount = 0;
    let fallbackInsertCount = 0;

    for (const messageRef of list) {
      if (!messageRef.id) continue;

      const message = await gmailApiGet<GmailMessage>(
        `/gmail/v1/users/me/messages/${encodeURIComponent(messageRef.id)}?format=full`,
        accessToken,
      );
      const headers = message.payload?.headers ?? [];
      const from = getHeaderValue(headers, "from");
      const to = getHeaderValue(headers, "to");
      const subject = getHeaderValue(headers, "subject");
      const fromEmail = extractEmailAddress(from);
      const toEmail = extractEmailAddress(to);
      const direction = classifyMailboxDirection(fromEmail, toEmail, mailboxEmail);
      let leadId = await matchLeadIdForAddresses(supabase, userId, fromEmail, toEmail);
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

      console.log("[DEBUG] email lead_id:", {
        message_id: message.id,
        thread_id: message.threadId,
        lead_id: row.lead_id,
      });

      console.log("Upserting email with keys:", {
        user_id: userId,
        thread_id: row.thread_id,
      });

      let emailPersisted = false;

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
            emailPersisted = true;
          }
        } else {
          insertErrorCount += 1;
          console.error("Email upsert error:", insertError);
        }
      } else {
        insertSuccessCount += 1;
        emailPersisted = true;
      }

      if (emailPersisted && !leadId) {
        const contactEmail = pickContactEmailForLeadFromDirection({
          direction,
          fromEmail,
          toEmail,
          mailboxEmail,
        });
        if (contactEmail) {
          leadId = await resolveOrCreateLeadId({
            supabase,
            userId,
            contactEmail,
            fromHeader: from,
          });
          if (leadId) {
            const updateQuery = supabase.from("emails").update({ lead_id: leadId }).eq("user_id", userId);
            if (row.thread_id) {
              await updateQuery.eq("thread_id", row.thread_id);
            } else if (row.message_id) {
              await updateQuery.eq("message_id", row.message_id);
            }
            row.lead_id = leadId;
          }
        }
      }

      const combinedBody = row.body || row.snippet || "";
      const willAttemptDirectTrigger = Boolean(emailPersisted && row.lead_id);

      console.log("[POST SYNC TRIGGER CHECK]", {
        messageId: message.id,
        leadId: row.lead_id,
        emailBodyLength: combinedBody.length,
        willAttemptDirectTrigger,
        bodyOkForAi: combinedBody.length > 20,
      });

      if (emailPersisted && row.lead_id) {
        await triggerLeadAiQualification({
          supabase,
          userId,
          leadId: row.lead_id,
          emailBody: combinedBody,
        });
      }
    }

    console.log("🚀 AFTER UPSERT LOOP");

    console.log("[POST /api/email/sync] insert summary:", {
      insertSuccessCount,
      fallbackInsertCount,
      insertErrorCount,
    });

    await reconcileEmailsToLeads(supabase, userId);
    console.log("[reconcileEmailsToLeads] ran after Gmail sync (links emails → leads via RPC)");

    let { threads } = await loadInboxThreadsForUser(supabase, userId);
    const catchup = await runInboxAiCatchup(supabase, userId, threads);
    threads = catchup.threads;

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

type GmailMessageHeader = { name?: string | null; value?: string | null };
type GmailMessage = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  payload?: {
    headers?: GmailMessageHeader[] | null;
    body?: { data?: string | null } | null;
    parts?: Array<{
      mimeType?: string | null;
      body?: { data?: string | null } | null;
      parts?: Array<{
        mimeType?: string | null;
        body?: { data?: string | null } | null;
      }> | null;
    }> | null;
  } | null;
};

async function gmailApiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = data.error?.message || "Gmail API request failed";
    throw new Error(message);
  }
  return data;
}

async function triggerLeadAiQualification({
  supabase,
  userId,
  leadId,
  emailBody,
}: {
  supabase: Awaited<ReturnType<typeof requireAuthUserId>>["supabase"];
  userId: string;
  leadId: string;
  emailBody: string;
}) {
  console.log("[POST SYNC] calling triggerAiIfNeeded (per-message path)", {
    leadId,
    emailBodyLength: emailBody.length,
  });
  try {
    const result = await triggerAiIfNeeded(supabase, userId, leadId, emailBody, {
      reason: "gmail_sync_email_persisted",
    });
    if (result?.status === "skipped" && result.reason !== "already_processed") {
      console.warn("[email/sync] AI lead qualification skipped:", result);
    }
  } catch (error) {
    console.error("[email/sync] AI lead qualification failed:", error);
  }
}

function pickContactEmailForLeadFromDirection({
  direction,
  fromEmail,
  toEmail,
  mailboxEmail,
}: {
  direction: "inbound" | "outbound" | null;
  fromEmail: string | null;
  toEmail: string | null;
  mailboxEmail: string;
}): string | null {
  const me = mailboxEmail.trim().toLowerCase();
  const from = fromEmail?.trim().toLowerCase() ?? "";
  const to = toEmail?.trim().toLowerCase() ?? "";

  if (direction === "inbound" && from && from !== me) {
    return from;
  }
  if (direction === "outbound" && to && to !== me) {
    return to;
  }
  if (from && from !== me) return from;
  if (to && to !== me) return to;
  return null;
}

function extractDisplayName(fromHeader: string | null): string | null {
  if (!fromHeader) return null;
  const cleaned = fromHeader.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  if (!cleaned) return null;
  const lowered = cleaned.toLowerCase();
  if (lowered.includes("@")) return null;
  return cleaned.slice(0, 80);
}

async function resolveOrCreateLeadId({
  supabase,
  userId,
  contactEmail,
  fromHeader,
}: {
  supabase: Awaited<ReturnType<typeof requireAuthUserId>>["supabase"];
  userId: string;
  contactEmail: string;
  fromHeader: string | null;
}): Promise<string | null> {
  const normalizedEmail = contactEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const displayName = extractDisplayName(fromHeader) ?? normalizedEmail.split("@")[0] ?? "New lead";
  const nowIso = new Date().toISOString();
  const leadBase = {
    user_id: userId,
    email: normalizedEmail,
    name: displayName,
    source: "email",
    created_at: nowIso,
  };

  const { data: created, error: createError } = await supabase
    .from("leads")
    .insert([leadBase])
    .select("id")
    .maybeSingle();

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    const sourceMissing = msg.includes("source") && msg.includes("column");
    if (!sourceMissing) {
      console.error("[sync] auto lead create failed:", createError);
      return null;
    }

    const { source: _drop, ...fallbackBase } = leadBase;
    const { data: fallback, error: fallbackError } = await supabase
      .from("leads")
      .insert([fallbackBase])
      .select("id")
      .maybeSingle();
    if (fallbackError) {
      console.error("[sync] auto lead create fallback failed:", fallbackError);
      return null;
    }
    if (fallback?.id) {
      console.log("[AUTO LEAD CREATED]", {
        leadId: fallback.id,
        email: normalizedEmail,
      });
      return fallback.id;
    }
    return null;
  }

  if (created?.id) {
    console.log("[AUTO LEAD CREATED]", {
      leadId: created.id,
      email: normalizedEmail,
    });
    return created.id;
  }
  return null;
}
