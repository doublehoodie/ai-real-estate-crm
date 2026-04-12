/**
 * Plain Supabase browser client (no `@supabase/ssr` cookie sync).
 * Do not use in Next.js UI: it will not see the SSR session and RLS will fail.
 * Use `@/lib/supabaseClient` (client) or `createSupabaseServerClient` (server).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
