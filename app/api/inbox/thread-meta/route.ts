import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAuthUserId } from "@/lib/requireAuthUser";

type Body = {
  threadId: string;
  isFavorite?: boolean;
  needsAction?: boolean;
};

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAuthUserId();

    const body = (await request.json()) as Body;
    const threadId = body.threadId?.trim();
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    if (body.isFavorite === undefined && body.needsAction === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("inbox_thread_meta")
      .select("is_favorite, needs_action")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .maybeSingle();

    if (existingError) {
      console.error("[thread-meta] load existing error:", existingError);
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    const nextFavorite =
      body.isFavorite !== undefined ? body.isFavorite : (existing?.is_favorite ?? false);
    const nextNeedsAction =
      body.needsAction !== undefined ? body.needsAction : (existing?.needs_action ?? true);

    const row = {
      user_id: userId,
      thread_id: threadId,
      is_favorite: nextFavorite,
      needs_action: nextNeedsAction,
      updated_at: new Date().toISOString(),
    };

    console.log("Upserting inbox_thread_meta with keys:", {
      user_id: userId,
      thread_id: row.thread_id,
      is_favorite: row.is_favorite,
      needs_action: row.needs_action,
    });

    const { error } = await supabase.from("inbox_thread_meta").upsert(row, {
      onConflict: "user_id,thread_id",
    });

    if (error) {
      console.error("Inbox thread meta upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
  }
}
