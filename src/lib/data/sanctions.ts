import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** A sanction as shown on the admin user page. */
export type Sanction = Pick<
  Database["public"]["Tables"]["moderation_actions"]["Row"],
  "id" | "kind" | "reason" | "created_at" | "expires_at" | "revoked_at"
>;

/** Maximum number of sanctions shown in a user's history. */
export const SANCTION_HISTORY_SIZE = 50;

/**
 * Lists the sanctions of a user, newest first. RLS only returns rows to holders of
 * `user.ban` / `user.mute`; anyone else gets an empty list.
 */
export async function listSanctions(targetId: string): Promise<Result<Sanction[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("moderation_actions")
      .select("id, kind, reason, created_at, expires_at, revoked_at")
      .eq("target_id", targetId)
      .order("created_at", { ascending: false })
      .limit(SANCTION_HISTORY_SIZE);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
