import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase session cookies on page requests. Never redirects (Guests may read).
 *
 * Every invocation of this function counts against the Vercel Hobby quotas (it is a Node function), so the
 * `matcher` below keeps it away from everything that does not need a session refresh:
 *  - requests without a session cookie (Guests): there is nothing to refresh;
 *  - link prefetches: they carry no new information about the session, and the real navigation that follows
 *    refreshes it. Without the proxy, a prefetch of a static shell is served by the CDN with no function at all;
 *  - static files and metadata files.
 * The prefetch check in the body stays as a safety net for requests the header filter would miss.
 */
export function proxy(request: NextRequest) {
  if (request.headers.get("next-router-prefetch")) return NextResponse.next();
  return updateSession(request);
}

// A Next.js matcher must be made of literals (no imports, no variables): `src/proxy.test.ts` checks that the cookie
// names below match `AUTH_COOKIE_NAME` (src/lib/supabase/cookie.ts) and that both entries share one `source`.
// Entries are alternatives: the session cookie is either `blocus-auth` or, when long, split in `blocus-auth.0`, …
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icons/|api/keep-alive|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
      has: [{ type: "cookie", key: "blocus-auth" }],
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source:
        "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icons/|api/keep-alive|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
      has: [{ type: "cookie", key: "blocus-auth.0" }],
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
