import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

/** Shows a sign-out button for signed-in users and a sign-in link for Guests. Reads cookies: wrap in Suspense. */
export async function AuthStatus() {
  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return (
      <Link href="/login" className="text-sm underline">
        Se connecter
      </Link>
    );
  }

  return (
    <form action={signOut}>
      <button type="submit" className="text-sm underline">
        Déconnexion
      </button>
    </form>
  );
}
