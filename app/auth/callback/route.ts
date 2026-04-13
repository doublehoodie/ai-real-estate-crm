import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/auth-js";

const DEFAULT_NEXT = "/inbox";

const EMAIL_OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Only same-origin relative paths; blocks open redirects like `//evil.com` or `https://...`. */
function safeRelativeNext(raw: string | null): string {
  if (raw == null) return DEFAULT_NEXT;
  const next = raw.trim();
  if (next.length === 0) return DEFAULT_NEXT;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  if (next.includes("\\")) return DEFAULT_NEXT;
  return next;
}

/**
 * Email magic link / OAuth: PKCE `code` exchange OR `token_hash` verify (no PKCE — works in in-app browsers).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const next = safeRelativeNext(searchParams.get("next"));

  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const code = searchParams.get("code");

  console.log("[auth/callback] entry", {
    path: url.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(token_hash),
    type: typeParam,
  });

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
          } catch {
            // ignore when not mutable
          }
        },
      },
    },
  );

  // Token hash path — no PKCE verifier; reliable when email template links here with token_hash + type (see Supabase magic link + PKCE docs).
  if (token_hash && typeParam && EMAIL_OTP_TYPES.has(typeParam)) {
    console.log("[auth/callback] verifyOtp path", { type: typeParam });
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: typeParam as EmailOtpType,
    });

    if (error) {
      console.error("[auth/callback] verifyOtp error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }

    console.log("[auth/callback] verifyOtp success", { userId: data.user?.id });
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (token_hash && typeParam && !EMAIL_OTP_TYPES.has(typeParam)) {
    console.error("[auth/callback] invalid type for token_hash:", typeParam);
    return NextResponse.redirect(
      new URL("/login?error=invalid_otp_type", request.url),
    );
  }

  // PKCE authorization code path (same browser / cookie storage as sign-in initiation).
  if (!code) {
    console.error("[auth/callback] missing code and token_hash");
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  console.log("[auth/callback] exchangeCodeForSession path");
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  console.log("[auth/callback] exchangeCodeForSession success", { userId: sessionData.user?.id });
  return NextResponse.redirect(new URL(next, request.url));
}
