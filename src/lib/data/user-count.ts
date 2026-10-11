import { cacheLife } from "next/cache";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reads the number of accounts once for everybody: the figure is public and the same for every visitor, so it is
 * cached and shared (the "feed" profile: one database read every 2 min per server instance, refreshed in the
 * background). No tag: nothing needs it fresher than that.
 *
 * It returns `null` on failure instead of throwing, unlike the other cached readers. This one runs while the build
 * prerenders `/login`, and an error thrown out of a cached function fails the whole build, even when the caller
 * catches it (typically: the build runs before the migration that adds the function). The cost is that a failure
 * is kept for the cache window (2 min), which is fine for a decorative line.
 */
async function fetchUserCount(): Promise<number | null> {
  "use cache";
  cacheLife("feed");

  try {
    // Bounded: the build prerenders /login, and a database that never answers must not hold it.
    const { data, error } = await createPublicClient()
      .rpc("public_user_count")
      .abortSignal(AbortSignal.timeout(4000));
    if (error) {
      // A warning, not an error: the line is decorative, and an error would raise the dev overlay for something
      // expected until the migration is applied (PGRST202: function not found). Reason only, nothing personal.
      console.warn("Public user count unavailable:", error.code ?? error.message);
      return null;
    }
    return typeof data === "number" ? data : null;
  } catch (cause) {
    console.warn(
      "Public user count unavailable:",
      cause instanceof Error ? cause.message : "unknown",
    );
    return null;
  }
}

/**
 * Number of accounts, for the login page. Readable by Guests (the database function returns this one integer and
 * nothing else). Until the migration that adds the function is applied, the read fails and the caller shows nothing.
 */
export async function getPublicUserCount(): Promise<Result<number, "load_failed">> {
  const count = await fetchUserCount();
  return count === null ? err("load_failed") : ok(count);
}
