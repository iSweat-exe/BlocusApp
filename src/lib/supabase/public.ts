import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for **public data only**: no cookies, no session, the `anon` role. It is what lets a
 * read be cached once and shared by every visitor (`'use cache'`), because the result cannot depend on who
 * asks. Never use it for anything a signed-in user may see differently from a Guest.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
