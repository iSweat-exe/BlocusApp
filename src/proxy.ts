import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase session cookies on page requests. Never redirects (Guests may read).
 * Link prefetches are skipped: they carry no new information about the session and the real navigation
 * that follows refreshes it, which saves a token check on roughly half of the requests.
 */
export function proxy(request: NextRequest) {
  if (request.headers.get("next-router-prefetch")) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, the service worker and PWA files: they never need a session.
    "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
