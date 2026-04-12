"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function UserNav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setEmail(user?.email ?? null);
        setLoading(false);
      }
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div style={{ fontSize: "13px", color: "#6b7280" }}>…</div>
    );
  }

  if (!email) {
    return (
      <Link href="/login" style={{ fontSize: "13px", color: "#0f766e", fontWeight: 600 }}>
        Log in
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" }}>
      <span style={{ color: "#374151" }}>
        Logged in as <strong>{email}</strong>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        style={{
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          background: "white",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
