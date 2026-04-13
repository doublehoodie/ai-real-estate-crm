"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { secondaryButton } from "@/lib/ui";

export function UserNav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        setEmail(session?.user?.email ?? null);
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
    return <div className="text-sm text-gray-500">…</div>;
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="rounded text-sm font-semibold text-[#1bbff6] transition-colors hover:text-[#1aa8db] focus:outline-none focus:ring-2 focus:ring-[#1bbff6] focus:ring-offset-2"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-gray-800">
      <span>
        Logged in as <strong>{email}</strong>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs bg-white ${secondaryButton}`}
      >
        Sign out
      </button>
    </div>
  );
}
