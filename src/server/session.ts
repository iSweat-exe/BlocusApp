import { cache } from "react";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** What the UI needs to know about the current user to show or hide controls. */
export type SessionPermissions = {
  userId: string;
  /** Application role from the `app_role` claim, `null` when the hook did not set it. */
  role: string | null;
  permissions: string[];
  /** E-mail of the account, when the sign-in provider shared it. */
  email: string | null;
  /** Sign-in providers linked to the account (e.g. `discord`, `google`), from the JWT `app_metadata`. */
  providers: string[];
  /** Avatar URL shared by the provider (`user_metadata`): untrusted, check it with `safeAvatarUrl()`. */
  avatarUrl: string | null;
};

/**
 * Reads the signed-in user and their permissions from the JWT claims, or `null` for a Guest.
 * For display only (hiding buttons): enforcement is `requirePermission()` plus RLS.
 * Wrapped in `React.cache`: the header, the page and its sections share one read per request.
 */
export const getSessionPermissions = cache(async (): Promise<SessionPermissions | null> => {
  const supabase = createClient(await requestCookies());
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const granted: unknown = claims.permissions;
  const permissions = Array.isArray(granted)
    ? granted.filter((item): item is string => typeof item === "string")
    : [];
  const role = typeof claims.app_role === "string" ? claims.app_role : null;
  const email = typeof claims.email === "string" && claims.email ? claims.email : null;
  // `providers` lists every linked identity; `provider` is only the first one used to sign up.
  const linked: unknown = claims.app_metadata?.providers;
  const first: unknown = claims.app_metadata?.provider;
  const providers = Array.isArray(linked)
    ? linked.filter((item): item is string => typeof item === "string")
    : typeof first === "string"
      ? [first]
      : [];
  const avatar: unknown = claims.user_metadata?.avatar_url;
  const avatarUrl = typeof avatar === "string" && avatar ? avatar : null;
  return { userId: claims.sub, role, permissions, email, providers, avatarUrl };
});
