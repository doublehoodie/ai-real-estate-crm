"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { primaryButton, secondaryButton } from "@/lib/ui";

const IN_APP_RE = /FBAN|FBAV|Instagram|Line|Twitter|Gmail/i;

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type");
  const queryError = searchParams.get("error");

  const isInAppBrowser = useMemo(() => {
    if (typeof window === "undefined") return false;
    return IN_APP_RE.test(window.navigator.userAgent);
  }, []);

  useEffect(() => {
    if (isInAppBrowser) return;
    console.log("FULL URL:", window.location.href);
    console.log("CODE:", code);
    console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (queryError) {
      router.replace("/login?error=auth_failed");
      return;
    }

    let cancelled = false;
    (async () => {
      let exchangeError: unknown = null;
      let exchangeData: unknown = null;

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        exchangeData = result.data;
        exchangeError = result.error;
      } else if (tokenHash && otpType) {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as EmailOtpType,
        });
        exchangeData = result.data;
        exchangeError = result.error;
      } else {
        router.replace("/login?error=auth_failed");
        return;
      }

      console.log("EXCHANGE RESULT:", exchangeData, exchangeError);
      if (cancelled) return;
      if (exchangeError) {
        console.error("Auth error:", exchangeError);
        router.replace("/login?error=auth_failed");
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      console.log("SESSION AFTER EXCHANGE:", sessionResult);
      const session = sessionResult.data.session;
      if (!session) {
        router.replace("/login?error=session_failed");
        return;
      }
      router.replace("/dashboard");
    })();

    return () => {
      cancelled = true;
    };
  }, [code, isInAppBrowser, otpType, queryError, router, tokenHash]);

  async function retryGoogle() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  if (isInAppBrowser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Complete login in your browser</h1>
          <p className="mb-3 text-sm text-gray-600">
            This login link was opened in an email app. Please open it in your browser to continue.
          </p>
          <p className="mb-4 text-xs text-gray-500">Tap the menu (•••) and choose &quot;Open in Safari/Chrome&quot;</p>
          <button
            type="button"
            onClick={() => window.open(window.location.href, "_blank")}
            className={`w-full justify-center ${primaryButton}`}
          >
            Open in browser
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
        <p className="text-sm text-gray-600">Signing you in...</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void retryGoogle()} className={primaryButton}>
            Continue with Google
          </button>
          <Link href="/login" className={secondaryButton}>
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
