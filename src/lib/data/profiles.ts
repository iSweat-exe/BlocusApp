import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** A user as shown in the admin list. */
export type AdminProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "pseudo" | "avatar_url" | "role" | "created_at"
>;

/** A role with its rank in the hierarchy. */
export type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "key" | "label" | "rank">;

/** Maximum number of users listed at once (search narrows the list). */
export const PROFILE_PAGE_SIZE = 50;

/** Escapes the characters that are wildcards in a `LIKE` pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Lists users ordered by pseudo, optionally filtered by a pseudo search.
 * @param search - Free text matched anywhere in the pseudo (trimmed, max 32 characters).
 */
export async function listProfiles(search = ""): Promise<Result<AdminProfile[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    let query = supabase
      .from("profiles")
      .select("id, pseudo, avatar_url, role, created_at")
      .order("pseudo", { ascending: true })
      .limit(PROFILE_PAGE_SIZE);
    const term = search.trim().slice(0, 32);
    if (term) query = query.ilike("pseudo", `%${escapeLike(term)}%`);
    const { data, error } = await query;
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/** Lists the roles of the hierarchy (reference data readable by signed-in users). */
export async function listRoles(): Promise<Result<Role[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.from("roles").select("key, label, rank").order("rank");
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/** The signed-in user's own profile, as shown on `/profil`. */
export type OwnProfile = AdminProfile & { updated_at: string };

/**
 * Reads one profile by id (RLS lets signed-in users read profiles).
 * @returns The profile, or `null` when it does not exist.
 */
export async function getProfile(id: string): Promise<Result<OwnProfile | null, "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("profiles")
      .select("id, pseudo, avatar_url, role, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Resolves user ids to pseudos (ids of deleted accounts are simply absent from the result).
 * @param ids - User ids to look up; duplicates and empty input are fine.
 */
export async function getPseudos(
  ids: string[],
): Promise<Result<Map<string, string>, "load_failed">> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return ok(new Map());
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.from("profiles").select("id, pseudo").in("id", unique);
    if (error) return err("load_failed", error.message);
    return ok(new Map(data.map((profile) => [profile.id, profile.pseudo])));
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
