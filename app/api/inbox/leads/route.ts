import { NextRequest, NextResponse } from "next/server";
import {
  buildScoredLeadPayload,
  isMissingColumnError,
  stripScoringPersistenceFields,
} from "@/lib/scoring";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";
import { isUuid, newLeadId } from "@/lib/ids";

type Body = {
  contactEmail: string;
  name?: string | null;
  /** When set, links this thread’s emails and notes to the resolved lead. */
  threadId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();
    console.log("user_id:", userId);

    const body = (await request.json()) as Body;
    const threadId = body.threadId?.trim() || null;
    const contactEmail = body.contactEmail?.trim().toLowerCase();
    if (!contactEmail) {
      return NextResponse.json({ error: "contactEmail is required" }, { status: 400 });
    }

    const displayName = body.name?.trim() || contactEmail.split("@")[0] || "New lead";

    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("email", contactEmail)
      .eq("user_id", userId)
      .maybeSingle();

    let leadId: string | null = null;

    if (existingLead?.id) {
      if (!isUuid(existingLead.id)) {
        return NextResponse.json(
          { error: "Existing lead id is not a valid UUID; fix data in database" },
          { status: 500 },
        );
      }
      leadId = existingLead.id;
    } else {
      const newId = newLeadId();
      const baseRow = buildScoredLeadPayload({
        name: displayName,
        email: contactEmail,
        phone: null,
        budget: null,
        budget_value: null,
        timeline: null,
        status: "New",
        notes: null,
        is_favorite: false,
      });

      const { data: inserted, error: insertError } = await supabase
        .from("leads")
        .insert([{ ...baseRow, id: newId, user_id: userId }])
        .select("id")
        .single();

      if (insertError) {
        const message = insertError.message ?? "";
        const scoringColumnMissing =
          isMissingColumnError(message, "score_breakdown") ||
          isMissingColumnError(message, "score_explanation") ||
          isMissingColumnError(message, "updated_at");

        if (!scoringColumnMissing) {
          console.error(insertError);
          return NextResponse.json(
            { error: insertError.message || "Failed to create lead" },
            { status: 400 },
          );
        }

        const fallbackRow = stripScoringPersistenceFields(baseRow);
        const { data: fallback, error: fallbackError } = await supabase
          .from("leads")
          .insert([{ ...fallbackRow, id: newId, user_id: userId }])
          .select("id")
          .single();

        if (fallbackError || !fallback) {
          console.error(fallbackError);
          return NextResponse.json(
            { error: fallbackError?.message || "Failed to create lead" },
            { status: 400 },
          );
        }
        leadId = isUuid(fallback.id) ? fallback.id : null;
      } else if (inserted) {
        leadId = isUuid(inserted.id) ? inserted.id : null;
      }

      if (!leadId) {
        return NextResponse.json({ error: "Lead not created (invalid id)" }, { status: 500 });
      }
    }

    if (!leadId) {
      return NextResponse.json({ error: "Lead not resolved" }, { status: 500 });
    }

    console.log("lead_id:", leadId);

    if (threadId) {
      const { error: threadEmailErr } = await supabase
        .from("emails")
        .update({ lead_id: leadId })
        .eq("user_id", userId)
        .eq("thread_id", threadId);

      if (threadEmailErr) {
        console.error("[inbox/leads] thread email link:", threadEmailErr);
      }

      const { error: threadNoteErr } = await supabase
        .from("notes")
        .update({ lead_id: leadId })
        .eq("user_id", userId)
        .eq("thread_id", threadId);

      if (threadNoteErr) {
        console.error("[inbox/leads] thread notes link:", threadNoteErr);
      }
    }

    const { error: errFrom } = await supabase
      .from("emails")
      .update({ lead_id: leadId })
      .eq("user_id", userId)
      .eq("from_email", contactEmail);

    const { error: errTo } = await supabase
      .from("emails")
      .update({ lead_id: leadId })
      .eq("user_id", userId)
      .eq("to_email", contactEmail);

    if (errFrom || errTo) {
      console.error(errFrom, errTo);
      return NextResponse.json(
        { error: "Lead saved but some emails may not be linked", leadId },
        { status: 207 },
      );
    }

    const { data: threadRows } = await supabase
      .from("emails")
      .select("thread_id")
      .eq("user_id", userId)
      .or(`from_email.eq.${contactEmail},to_email.eq.${contactEmail}`);

    const threadIds = [
      ...new Set((threadRows ?? []).map((r) => r.thread_id).filter(Boolean)),
    ] as string[];

    if (threadIds.length > 0) {
      const { error: noteLinkErr } = await supabase
        .from("notes")
        .update({ lead_id: leadId })
        .eq("user_id", userId)
        .in("thread_id", threadIds);

      if (noteLinkErr) {
        console.error("[inbox/leads] link thread notes to lead:", noteLinkErr);
      }
    }

    return NextResponse.json({ success: true, leadId });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to add lead from inbox" }, { status: 500 });
  }
}
