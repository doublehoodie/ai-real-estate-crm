"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearAllState } from "@/lib/state/clearAllState";
import { applyTheme, resolveThemeForUser } from "@/lib/theme/theme";
import { setAssistantSessionUser } from "@/lib/stores/assistantSessionStore";

export function AuthStateBridge() {
  const currentUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncForUser = (userId: string | null, shouldClear: boolean) => {
      if (shouldClear) {
        clearAllState();
      }
      const nextTheme = resolveThemeForUser(userId);
      setAssistantSessionUser(userId);
      applyTheme(nextTheme);
      console.log("THEME SELECTED:", nextTheme);
      console.log("HTML CLASSES:", document.documentElement.className);
      currentUserRef.current = userId;
    };

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      syncForUser(user?.id ?? null, false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const userChanged = currentUserRef.current !== nextUserId;
      syncForUser(nextUserId, userChanged);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
