import { createBrowserClient } from "@supabase/ssr";

if (typeof window !== "undefined") {
  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
