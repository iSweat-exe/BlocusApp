import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveDiscordAuthorizeUrl } from "@/features/auth/discord-url";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the Discord OAuth flow (the PKCE verifier cookie is set on the response).
 *
 * - Plain GET: redirects to the provider. It lets the login button be a normal link that works without
 *   JavaScript, before hydration and in installed PWAs (a form + Server Action redirect is blocked by
 *   `form-action 'self'` and can be ignored by iOS when the navigation happens after an async call).
 * - `?format=json`: returns `{ url }` instead, pointing straight at `https://discord.com/oauth2/authorize`
 *   when possible. The login link then targets Discord itself, so a tap can open the Discord mobile app
 *   (universal links are not triggered by a server redirect, only by the tapped URL).
 */
export async function GET(request: Request) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${getSiteUrl()}/auth/callback`, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return new URL(request.url).searchParams.get("format") === "json"
      ? NextResponse.json({ error: "oauth_start" }, { status: 502 })
      : NextResponse.redirect(new URL("/login?error=oauth_start", request.url));
  }

  if (new URL(request.url).searchParams.get("format") === "json") {
    const direct = await resolveDiscordAuthorizeUrl(data.url);
    return NextResponse.json(
      { url: direct ?? data.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(data.url);
}
