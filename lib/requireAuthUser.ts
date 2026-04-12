import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/ids";

export { isUuid } from "@/lib/ids";

export class NotAuthenticatedError extends Error {
  constructor(message = "User not authenticated") {
    super(message);
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Requires a valid Supabase session with a UUID `user.id`.
 * Never use placeholder or request-derived user ids for `user_id` columns.
 */
export async function requireAuthUserId(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Supabase getUser error:", error);
  }

  if (!user?.id) {
    throw new NotAuthenticatedError();
  }

  if (!isUuid(user.id)) {
    console.error("Invalid auth user id (expected UUID):", user.id);
    throw new NotAuthenticatedError();
  }

  return { supabase, userId: user.id };
}

export function handleAuthError(e: unknown): { message: string; status: number } | null {
  if (e instanceof NotAuthenticatedError) {
    return { message: e.message, status: 401 };
  }
  return null;
}
