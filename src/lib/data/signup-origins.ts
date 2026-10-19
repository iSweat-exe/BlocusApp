import "server-only";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** Where an account was created from: a coarse location, never the IP address. */
export type SignupOrigin = Pick<
  Database["public"]["Tables"]["signup_origins"]["Row"],
  "country" | "region" | "city"
>;

/**
 * Reads where one user signed up from. RLS only returns the row to holders of `user.origin.view`, so for anyone
 * else the result is `null`, exactly as for an account whose origin was not recorded.
 * @returns The origin, or `null` when there is none (or the caller may not see it).
 */
export async function getSignupOrigin(
  userId: string,
): Promise<Result<SignupOrigin | null, "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("signup_origins")
      .select("country, region, city")
      .eq("user_id", userId)
      .maybeSingle();
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
