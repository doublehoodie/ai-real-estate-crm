import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const queryError = url.searchParams.get("error");

  if (queryError) {
    return redirectTo(request, "/login?error=auth_failed");
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error", error);
      return redirectTo(request, "/login?error=auth_failed");
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (error) {
      console.error("[auth/callback] verifyOtp error", error);
      return redirectTo(request, "/login?error=auth_failed");
    }
  } else {
    return redirectTo(request, "/login?error=auth_failed");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return redirectTo(request, "/login?error=session_failed");
  }

  return redirectTo(request, "/dashboard");
}
