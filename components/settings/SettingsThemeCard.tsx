"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { applyTheme, resolveThemeForUser, storeTheme, type ThemeChoice } from "@/lib/theme/theme";


export function SettingsThemeCard() {
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const sync = (id: string | null) => {
      const resolved = resolveThemeForUser(id);
      setUserId(id);
      setTheme(resolved);
      applyTheme(resolved);
    };

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      sync(user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      sync(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function updateTheme(next: ThemeChoice) {
    setTheme(next);
    storeTheme(userId, next);
    applyTheme(next);
    console.log("THEME SELECTED:", next);
    console.log("HTML CLASSES:", document.documentElement.className);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Appearance</h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        Choose your preferred theme. Default is light for new users.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => updateTheme("dark")}
          className={`rounded-xl border px-4 py-3 text-left transition duration-200 ease-out ${
            theme === "dark"
              ? "border-green-500/50 bg-green-500/10 text-slate-900 dark:text-white"
              : "border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-900 text-slate-900 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800"
          }`}
        >
          <div className="text-sm font-medium">Dark</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Great for low-light work</div>
        </button>

        <button
          type="button"
          onClick={() => updateTheme("light")}
          className={`rounded-xl border px-4 py-3 text-left transition duration-200 ease-out ${
            theme === "light"
              ? "border-green-500/50 bg-green-500/10 text-slate-900 dark:text-white"
              : "border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-900 text-slate-900 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800"
          }`}
        >
          <div className="text-sm font-medium">Light</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Default for new users</div>
        </button>
      </div>
    </section>
  );
}
