import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-initiated magic link: PKCE verifier is stored in HttpOnly cookies on this response.
 * Prefer opening the magic link in the same browser that requested it; for in-app email clients,
 * use the Supabase email template with token_hash → /auth/callback (verifyOtp path).
 */
export async function POST(request: Request) {
  console.log("[magic-link] POST entry");

  let body: { email?: string; next?: string };
  try {
    body = (await request.json()) as { email?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const next = typeof body.next === "string" ? body.next : "/";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
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
          } catch (e) {
            console.error("[magic-link] cookie setAll", e);
          }
        },
      },
    },
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const origin = site ?? new URL(request.url).origin;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  console.log("[magic-link] emailRedirectTo:", emailRedirectTo);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    console.error("[magic-link] signInWithOtp error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.log("[magic-link] signInWithOtp ok");
  return NextResponse.json({ ok: true });
}
