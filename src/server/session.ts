import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** What the UI needs to know about the current user to show or hide controls. */
export type SessionPermissions = {
  userId: string;
  /** Application role from the `app_role` claim, `null` when the hook did not set it. */
  role: string | null;
  permissions: string[];
  /** E-mail of the account, when the sign-in provider shared it. */
  email: string | null;
  /** Sign-in provider (e.g. `discord`), from the JWT `app_metadata`. */
  provider: string | null;
  /** Avatar URL shared by the provider (`user_metadata`): untrusted, check it with `safeAvatarUrl()`. */
  avatarUrl: string | null;
};

/**
 * Reads the signed-in user and their permissions from the JWT claims, or `null` for a Guest.
 * For display only (hiding buttons): enforcement is `requirePermission()` plus RLS.
 */
export async function getSessionPermissions(): Promise<SessionPermissions | null> {
  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const granted: unknown = claims.permissions;
  const permissions = Array.isArray(granted)
    ? granted.filter((item): item is string => typeof item === "string")
    : [];
  const role = typeof claims.app_role === "string" ? claims.app_role : null;
  const email = typeof claims.email === "string" && claims.email ? claims.email : null;
  const provider =
    typeof claims.app_metadata?.provider === "string" ? claims.app_metadata.provider : null;
  const avatar: unknown = claims.user_metadata?.avatar_url;
  const avatarUrl = typeof avatar === "string" && avatar ? avatar : null;
  return { userId: claims.sub, role, permissions, email, provider, avatarUrl };
}
