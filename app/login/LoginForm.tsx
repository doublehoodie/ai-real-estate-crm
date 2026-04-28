"use client";

import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { primaryButton, secondaryButton } from "@/lib/ui";

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error") ?? searchParams.get("reason");
  const canonicalOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "oauth" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const emailRedirectTo = `${canonicalOrigin}/auth/callback`;
    console.log("MAGIC LINK REDIRECT:", emailRedirectTo);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      console.error("[magic-link] signInWithOtp failed:", error.message);
      setStatus("error");
      setMessage("Login failed or expired. Please try again.");
      return;
    }

    setStatus("sent");
    setMessage("Check your email");
  }

  async function continueWithGoogle() {
    setStatus("oauth");
    setMessage(null);
    const redirectTo = `${canonicalOrigin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      setStatus("error");
      setMessage("Login failed or expired. Please try again.");
      return;
    }
    console.log("OAUTH URL:", data?.url);
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    setStatus("error");
    setMessage("Login failed or expired. Please try again.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f3f4f6] px-6 py-12 transition-all duration-200">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-all duration-200">
        <div className="mb-8 flex justify-center">
          <Image
            src="/grassleads.png"
            alt="GrassLeads"
            width={160}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold tracking-tight text-gray-900">Sign in</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          We’ll email you a magic link — no password.
        </p>
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          New users: if sign-in does not complete on the first attempt, please sign in again while we fix a temporary login issue.
        </p>

        {errorParam && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{errorParam}</p>}

        <button
          type="button"
          onClick={() => void continueWithGoogle()}
          disabled={status === "sending" || status === "oauth"}
          className={`mb-4 w-full ${secondaryButton} justify-center border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60`}
        >
          {status === "oauth" ? "Redirecting…" : "Continue with Google"}
        </button>

        <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[15px] text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1AB523]"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending" || status === "oauth" || status === "sent"}
            className={`${primaryButton} disabled:opacity-60`}
          >
            {status === "sending" ? "Sending…" : "Send Magic Link"}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-gray-500">
          For best experience, use the same device or try Google login.
        </p>

        {message && (
          <p
            className={`mt-5 text-center text-sm transition-all duration-200 ${
              status === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
