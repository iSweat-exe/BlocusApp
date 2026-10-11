/** Longest search the database layer accepts (see `listProfiles`). */
export const SEARCH_MAX_LENGTH = 32;

/** Validated query-string parameters of the users page. */
export type UserListParams = { search: string; role: string | null };

/**
 * Reads the `q` (pseudo search) and `role` parameters, ignoring anything invalid: a role that does not exist
 * is dropped instead of showing an empty list nobody asked for.
 */
export function parseUserListParams(
  raw: { q?: unknown; role?: unknown },
  roleKeys: readonly string[],
): UserListParams {
  const search = typeof raw.q === "string" ? raw.q.trim().slice(0, SEARCH_MAX_LENGTH) : "";
  const role = typeof raw.role === "string" && roleKeys.includes(raw.role) ? raw.role : null;
  return { search, role };
}

/** URL of the users page for a search and a role filter (either may be empty). */
export function userListHref({
  search = "",
  role = null,
}: {
  search?: string;
  role?: string | null;
}): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (role) params.set("role", role);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}
