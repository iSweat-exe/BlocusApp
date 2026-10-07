"use client";

import { useEffect, useState } from "react";

const FALLBACK_HREF = "/auth/login/discord";

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
      try {
        const response = await fetch(`${FALLBACK_HREF}?format=json`, { cache: "no-store" });
        if (!response.ok) return;
        const { url } = (await response.json()) as { url?: unknown };
        // Only ever point the link at Discord or at our own Supabase project.
        if (!cancelled && typeof url === "string" && url.startsWith("https://")) setHref(url);
      } catch {
        // Keep the fallback link.
      }
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
    <a
      href={href}
      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5865F2] px-4 py-3 text-center font-medium text-white active:bg-[#4752c4]"
    >
      Continuer avec Discord
    </a>
  );
}
