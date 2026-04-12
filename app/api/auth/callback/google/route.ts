import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { isUuid } from "@/lib/ids";

export async function GET(req: Request) {
  console.log("CALLBACK HIT", req.url);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    if (!code) {
      console.error("Missing OAuth code");
      return NextResponse.json({ error: "Missing code in callback" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get("gmail_oauth_state")?.value;
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      console.error("OAuth state mismatch or missing", {
        hasReturnedState: Boolean(returnedState),
        hasExpectedState: Boolean(expectedState),
      });
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // ignore
            }
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Supabase getUser error:", userError);
    }

    if (!user?.id || !isUuid(user.id)) {
      console.error("Callback: no authenticated user or invalid user id", user?.id);
      return new Response("User not authenticated", { status: 401 });
    }

    console.log("Using user_id:", user.id);

    const oauth2Client = getOAuthClient();

    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
    } catch (error) {
      console.error("OAuth token exchange failed", error);
      return NextResponse.json(
        { error: "Google token exchange failed" },
        { status: 500 },
      );
    }

    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress ?? null;

    const expiryDateMs =
      tokens.expiry_date ?? Date.now() + 3600 * 1000;

    console.log("Saving integration:", {
      expiry_date: tokens.expiry_date,
      expires_in: (tokens as { expires_in?: number }).expires_in,
    });

    try {
      const { error: upsertError } = await supabase.from("user_integrations").upsert(
        {
          user_id: user.id,
          provider: "gmail",
          email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: expiryDateMs,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        },
      );

      if (upsertError) {
        console.error("Failed to save Gmail integration", upsertError);
        return NextResponse.json(
          { error: upsertError.message || "Failed to save integration" },
          { status: 500 },
        );
      }
    } catch (dbError) {
      console.error("Supabase upsert threw", dbError);
      return NextResponse.json(
        { error: "Database error while saving Gmail integration" },
        { status: 500 },
      );
    }

    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error) {
    console.error("Unhandled callback error", error);
    return NextResponse.json(
      { error: "Failed to complete Google OAuth callback" },
      { status: 500 },
    );
  }
}
