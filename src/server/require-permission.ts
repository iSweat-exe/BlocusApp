import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** Why a permission check failed. */
export type PermissionError = "unauthenticated" | "forbidden";

/** Options of {@link requirePermission}. */
export type RequirePermissionOptions = {
  /**
   * Ask the database instead of trusting the JWT claims, which can be up to one token lifetime stale.
   * Use it for sensitive actions (ban, role assignment).
   */
  fresh?: boolean;
};

/**
 * Checks that the current user holds `permission`. Call it first in every Server Action and Route
 * Handler: the UI only hides things, RLS and this check enforce them.
 * @param permission - Permission key such as `announcement.publish`.
 * @param options - See {@link RequirePermissionOptions}.
 * @returns The user id, or `unauthenticated` / `forbidden`.
 */
export async function requirePermission(
  permission: string,
  options: RequirePermissionOptions = {},
): Promise<Result<{ userId: string }, PermissionError>> {
  const supabase = createClient(await requestCookies());
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (!userId) return err("unauthenticated");

  if (options.fresh) {
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      p_user_id: userId,
      p_permission: permission,
    });
    return !error && allowed === true ? ok({ userId }) : err("forbidden");
  }

  const granted: unknown = claims.permissions;
  const allowed = Array.isArray(granted) && granted.includes(permission);
  return allowed ? ok({ userId }) : err("forbidden");
}
