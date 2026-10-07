const DISCORD_ORIGIN = "https://discord.com";

/**
 * Turns the URL Supabase redirects to (`/api/oauth2/authorize`) into the plain web URL
 * `https://discord.com/oauth2/authorize`, the form Discord opens in its mobile app when it is installed.
 * Anything that is not an authorize URL on discord.com is refused (`null`), never forwarded.
 */
export function toDiscordAppUrl(location: string | null): string | null {
  if (!location) return null;
  try {
    const url = new URL(location);
    if (url.origin !== DISCORD_ORIGIN) return null;
    if (url.pathname === "/api/oauth2/authorize") url.pathname = "/oauth2/authorize";
    return url.pathname === "/oauth2/authorize" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Asks Supabase where its authorize endpoint sends the user (without following the redirect), so the
 * login link can point straight at Discord. Returns `null` on any problem: callers fall back to the
 * Supabase URL, which still works (just through a redirect).
 * @param supabaseAuthorizeUrl - The URL returned by `signInWithOAuth({ skipBrowserRedirect: true })`.
 * @param fetchImpl - Injected in tests.
 */
export async function resolveDiscordAuthorizeUrl(
  supabaseAuthorizeUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(supabaseAuthorizeUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
    });
    return toDiscordAppUrl(response.headers.get("location"));
  } catch {
    return null;
  }
}
