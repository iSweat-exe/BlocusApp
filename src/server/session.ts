import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** What the UI needs to know about the current user to show or hide controls. */
export type SessionPermissions = { userId: string; permissions: string[] };

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
  return { userId: claims.sub, permissions };
}
