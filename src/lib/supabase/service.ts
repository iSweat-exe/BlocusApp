import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client with the **service role**: it bypasses RLS. Server only (the key must never be prefixed
 * with `NEXT_PUBLIC_`), and only for jobs that have no signed-in user, such as the daily health snapshot
 * (`src/features/health/cron-snapshot.ts`). Every database function it calls must still check the role itself.
 * Throws when `SUPABASE_SERVICE_ROLE_KEY` is not set.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
