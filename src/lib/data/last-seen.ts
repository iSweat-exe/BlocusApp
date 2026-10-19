import "server-only";
import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/**
 * When a user was last seen. The database refuses callers without `user.activity.view` (`forbidden`), so for
 * anyone else this is a failed read, not a leak.
 * @returns The date (ISO 8601), or `null` for a user never seen (account older than the tracking).
 */
export async function getLastSeen(userId: string): Promise<Result<string | null, "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.rpc("get_last_seen", { p_user_id: userId });
    return error ? err("load_failed", error.message) : ok(data ?? null);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
