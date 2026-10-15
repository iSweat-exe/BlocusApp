/**
 * Name of the Supabase session cookie. Fixed (instead of the default `sb-<project ref>-auth-token`) so that
 * `src/proxy.ts` can run only for requests that carry a session: a Next.js matcher accepts literals only, and
 * the project ref differs between local and production. Every Supabase client must use it, or the session
 * written by one would not be read by the others.
 *
 * Long sessions are split in chunks named `<name>.0`, `<name>.1`, … (no `<name>` cookie then): the matcher
 * lists both forms. `src/proxy.test.ts` checks that the literals of the matcher match this constant.
 */
export const AUTH_COOKIE_NAME = "blocus-auth";

/**
 * Options to pass to `createServerClient`. The session cookies are `httpOnly` (`@supabase/ssr` leaves them
 * readable by scripts by default): page scripts, including an injected one, cannot read the tokens. The whole
 * app reads the session on the server (Server Components, Route Handlers, proxy), so nothing needs them in
 * the browser. `SameSite=Lax` and `Secure` on HTTPS come from the library defaults.
 */
export const authCookieOptions = { name: AUTH_COOKIE_NAME, httpOnly: true };
