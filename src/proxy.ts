import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Refreshes the Supabase session cookies on every page request. Never redirects (Guests may read). */
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, the service worker and PWA files: they never need a session.
    "/((?!_next/static|_next/image|sw\.js|manifest\.webmanifest|icons/|favicon\.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
