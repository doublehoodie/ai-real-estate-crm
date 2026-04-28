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
    return <div className="text-sm text-slate-500 dark:text-zinc-500 transition-all duration-200">…</div>;
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 transition-all duration-200 hover:text-emerald-500 dark:hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-zinc-950"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 transition-all duration-200">
      <span className="text-slate-600 dark:text-slate-400">
        Logged in as <strong className="font-medium text-slate-900 dark:text-white">{email}</strong>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="cursor-pointer rounded-lg border border-green-500/40 bg-transparent px-3 py-1.5 text-xs font-medium text-green-400 transition-all duration-200 ease-out hover:bg-green-500/10 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        Sign out
      </button>
    </div>
  );
}
