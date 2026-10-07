"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The page is not refreshed again before this delay: it matches the 30 s of the shared data cache. */
export const MIN_REFRESH_GAP_MS = 30_000;

/**
 * Keeps the app up to date without polling: when the user comes back (the tab or the installed PWA becomes
 * visible again, the page is restored from the back/forward cache, or the network returns), the server
 * components are refreshed, at most once every 30 s. Nothing runs in the background while nobody looks, so it
 * costs nothing when the app is idle. State of client components (open dialogs, typed text) is preserved.
 */
export function RefreshOnReturn() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    // The page has just been rendered: it is fresh now.
    lastRefresh.current = Date.now();

    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_REFRESH_GAP_MS) return;
      lastRefresh.current = now;
      router.refresh();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshIfStale();
    };

    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", refreshIfStale);
    };
  }, [router]);

  return null;
}
