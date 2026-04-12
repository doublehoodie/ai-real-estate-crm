import { createClient } from "@supabase/supabase-js";

/**
 * Lightweight server-side Supabase client for API routes.
 * Uses the configured project URL and anon key.
 */
export const serverSupabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

