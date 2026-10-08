import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the Google OAuth flow (the PKCE verifier cookie is set on the response). A plain GET redirect,
 * so the login button is a normal link that works without JavaScript and in installed PWAs.
 */
export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${getSiteUrl()}/auth/callback`, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth_start", request.url));
  }
  return NextResponse.redirect(data.url);
}
