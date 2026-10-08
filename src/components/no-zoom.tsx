"use client";

import { useEffect } from "react";

/**
 * Keeps the app at 100 % on iOS Safari, which ignores `user-scalable=no` and still starts a pinch zoom (the
 * non-standard `gesture*` events). Cancelling them stops it. MapLibre's own pinch on the map is built from touch
 * events, not from these, so the map keeps zooming. Renders nothing.
 */
export function NoZoom() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    const options = { passive: false } as const;
    document.addEventListener("gesturestart", block, options);
    document.addEventListener("gesturechange", block, options);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
    };
  }, []);

  return null;
}
