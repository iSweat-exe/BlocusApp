"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The page is not refreshed twice within this delay: it matches the 30 s of the shared data cache. */
export const MIN_REFRESH_GAP_MS = 30_000;

/**
 * The user must have been away at least this long before coming back refreshes the page. A quick switch to
 * another app (a message, the camera, a copied address) must not cost a full server render: every refresh is a
 * function invocation plus the transfer of the whole page, which is what the free quotas are made of.
 */
export const MIN_AWAY_MS = 120_000;

/**
 * Keeps the app up to date without polling: when the user comes back after a while (the tab or the installed
 * PWA was hidden for at least {@link MIN_AWAY_MS}, the page is restored from the back/forward cache, or the
 * network returns), the server components are refreshed. Nothing runs in the background while nobody looks, so
 * it costs nothing when the app is idle. State of client components (open dialogs, typed text) is preserved.
 * (No `usePathname` here: a runtime hook in the layout would stop the pages from being prerendered.)
 */
export function RefreshOnReturn() {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  // The page that was just rendered is fresh.
  useEffect(() => {
    lastRefresh.current = Date.now();
  }, []);

  useEffect(() => {
    const refresh = () => {
      lastRefresh.current = Date.now();
      router.refresh();
    };

    /** The user is back. `unknownAway`: no hidden event was seen (back/forward cache), so use the page age. */
    const onReturn = (unknownAway: boolean) => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const left = hiddenAt.current;
      hiddenAt.current = null;
      const away = left === null ? (unknownAway ? now - lastRefresh.current : 0) : now - left;
      if (away < MIN_AWAY_MS || now - lastRefresh.current < MIN_REFRESH_GAP_MS) return;
      refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else onReturn(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onReturn(true);
    };
    const onOnline = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current >= MIN_REFRESH_GAP_MS) refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
