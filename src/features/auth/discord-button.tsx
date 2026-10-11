"use client";

import { useEffect, useState } from "react";

const FALLBACK_HREF = "/auth/login/discord";

/**
 * Every call to the endpoint stores a new PKCE verifier in a cookie, and the verifier must be the one of the
 * URL the link points at. Two requests in flight (React Strict Mode runs effects twice in development) can
 * answer in any order, so the cookie could hold the first verifier while the link carries the second: the
 * callback then fails. Calls made while one is pending share its request.
 */
let pending: Promise<string | null> | null = null;

function loadDiscordUrl(): Promise<string | null> {
  pending ??= (async () => {
    try {
      const response = await fetch(`${FALLBACK_HREF}?format=json`, { cache: "no-store" });
      if (!response.ok) return null;
      const { url } = (await response.json()) as { url?: unknown };
      // Only ever point the link at Discord or at our own Supabase project.
      return typeof url === "string" && url.startsWith("https://") ? url : null;
    } catch {
      return null; // Keep the fallback link.
    }
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * "Continue with Discord" link. It works as a plain link without JavaScript (server redirect). Once
 * hydrated it asks the server for the Discord URL itself and points the link at it, so a tap can open
 * the Discord mobile app when it is installed. A plain `<a>` (not `next/link`, which would prefetch it).
 */
export function DiscordButton() {
  const [href, setHref] = useState(FALLBACK_HREF);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const url = await loadDiscordUrl();
      if (!cancelled && url) setHref(url);
    };
    void load();
    // The PKCE cookie is set with each call: refresh it when the page comes back from the cache.
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void load();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  return (
    <a href={href} className="btn w-full gap-3 bg-discord text-white active:bg-discord-strong">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
      </svg>
      Continuer avec Discord
    </a>
  );
}
