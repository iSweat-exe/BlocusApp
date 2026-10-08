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
    <a href={href} className="btn w-full bg-discord text-white active:bg-discord-strong">
      Continuer avec Discord
    </a>
  );
}
