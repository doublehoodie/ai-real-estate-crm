import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Starts Gmail OAuth. Requires an authenticated Supabase session (cookies).
 * Does not pass user_id in query or state — CSRF state is a random value stored in a cookie.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Supabase getUser error:", userError);
  }

  if (!user) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  const oauthState = crypto.randomUUID();

  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    state: oauthState,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", oauthState, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
