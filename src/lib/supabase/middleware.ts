import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "./cookie";
import { createEpochReader, isTokenStale } from "./permission-epoch";
import { createPublicClient } from "./public";

// One read of the permission epoch per warm instance every few seconds (see permission-epoch.ts). It uses the
// cookie-less public client: the epoch is a plain timestamp, the same for everybody, and this reader outlives
// the request that created it.
const readEpoch = createEpochReader(async () => {
  const { data, error } = await createPublicClient().rpc("get_permission_epoch");
  return error ? null : data;
});
// Epoch for which each user's token was already re-issued here: guards against a refresh loop if the clocks
// of the auth server and the database ever disagree by a few seconds.
const refreshedFor = new Map<string, string>();
const MAX_REMEMBERED_USERS = 5000;

/**
 * Refreshes the Supabase session cookies for an incoming request.
 * Meant to be called from the Next.js proxy (formerly "middleware") entry point.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates the JWT and triggers a token refresh when needed.
  // Do not run any code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();

  // Roles and permissions live in the JWT, which is only re-issued when it expires (up to an hour on a hosted
  // project): a promotion or a granted permission would stay invisible that long. When they changed after the
  // token was issued, re-issue it now so the page and the Server Actions of this very request see them.
  const claims = data?.claims;
  if (claims?.sub) {
    const epoch = await readEpoch();
    if (epoch && isTokenStale(claims.iat, epoch) && refreshedFor.get(claims.sub) !== epoch) {
      if (refreshedFor.size >= MAX_REMEMBERED_USERS) refreshedFor.clear();
      refreshedFor.set(claims.sub, epoch);
      // Cookies are written through `setAll` above, on the request and the response.
      await supabase.auth.refreshSession();
    }
  }

  return supabaseResponse;
}
