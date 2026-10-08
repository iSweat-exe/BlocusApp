import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];

/** A permission of the catalogue. */
export type PermissionInfo = Pick<Tables["permissions"]["Row"], "key" | "description">;
/** A link between a role and a permission. */
export type RolePermission = Pick<Tables["role_permissions"]["Row"], "role" | "permission">;
/** A per-user override. */
export type UserOverride = Pick<Tables["permission_overrides"]["Row"], "permission" | "effect">;

/** Lists the permission catalogue (reference data readable by signed-in users). */
export async function listPermissions(): Promise<Result<PermissionInfo[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("permissions")
      .select("key, description")
      .order("key");
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/** Lists which permissions each role holds (`super_admin` is implicit: it holds them all). */
export async function listRolePermissions(): Promise<Result<RolePermission[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.from("role_permissions").select("role, permission");
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/** Lists the overrides of one user. RLS: own rows, or all rows with `permission.manage`. */
export async function listUserOverrides(
  userId: string,
): Promise<Result<UserOverride[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("permission_overrides")
      .select("permission, effect")
      .eq("user_id", userId);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
