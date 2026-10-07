import Link from "next/link";
import { getSessionPermissions } from "@/server/session";
import { signOut } from "./actions";

/**
 * Header controls: sign-in link for Guests; admin link (with `role.assign`) and sign-out for users.
 * Reads cookies: wrap in Suspense.
 */
export async function AuthStatus() {
  const session = await getSessionPermissions();

  if (!session) {
    return (
      <Link href="/login" className="text-sm underline">
        Se connecter
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {session.permissions.includes("role.assign") && (
        <Link href="/admin" className="text-sm underline">
          Administration
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className="text-sm underline">
          Déconnexion
        </button>
      </form>
    </div>
  );
}
