"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/** Starts the Discord OAuth flow and redirects the browser to Discord's consent screen. */
export async function signInWithDiscord(): Promise<void> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${getSiteUrl()}/auth/callback`, skipBrowserRedirect: true },
  });

  if (error || !data.url) redirect("/login?error=oauth_start");
  redirect(data.url);
}

/** Ends the current session and sends the user back to the login page. */
export async function signOut(): Promise<void> {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect("/login");
}
