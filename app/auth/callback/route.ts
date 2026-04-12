import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEFAULT_NEXT = "/inbox";

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
 * Email magic link (and OAuth) redirect handler: exchanges `code` for a session cookie.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRelativeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
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
          } catch {
            // ignore when not mutable
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession", error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
