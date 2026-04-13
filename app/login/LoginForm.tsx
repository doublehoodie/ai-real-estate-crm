"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { primaryButton } from "@/lib/ui";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    const origin =
      fromEnv ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    console.log("Magic link emailRedirectTo:", emailRedirectTo);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      console.error(error);
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--background, #f3f5f8)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "white",
          borderRadius: "12px",
          padding: "28px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h1 className="mb-2 text-[22px] text-gray-900">Sign in</h1>
        <p className="mb-5 text-sm text-gray-500">
          We’ll email you a magic link — no password.
        </p>

        {errorParam && (
          <p style={{ color: "#b91c1c", fontSize: "13px", marginBottom: "12px" }}>{errorParam}</p>
        )}

        <form onSubmit={sendMagicLink} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#374151" }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "15px",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending" || status === "sent"}
            className={`rounded-full border-0 px-4 py-2.5 font-semibold ${primaryButton}`}
          >
            {status === "sending" ? "Sending…" : "Send Magic Link"}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: "16px", color: status === "error" ? "#b91c1c" : "#059669", fontSize: "14px" }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
