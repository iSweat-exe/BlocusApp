import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the Discord OAuth flow. It is a plain GET so the login button can be a normal link: it works
 * without JavaScript, before hydration and in installed PWAs (a form + Server Action redirect is blocked
 * by `form-action 'self'` and can be ignored by iOS when the navigation happens after an async call).
 * The PKCE verifier cookie is set on this response, then the browser follows the redirect to Discord.
 */
export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${getSiteUrl()}/auth/callback`, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth_start", request.url));
  }
  return NextResponse.redirect(data.url);
}
