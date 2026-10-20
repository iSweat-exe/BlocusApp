"use client";

import { useSyncExternalStore } from "react";

/**
 * Template photos (Lorem Picsum, see `docs/credits.md`), to be replaced by images the team owns the rights to:
 * drop the new files here or change this list.
 */
export const LOGIN_BACKGROUNDS = [
  "/images/login/login-bg-1.jpg",
  "/images/login/login-bg-2.jpg",
  "/images/login/login-bg-3.jpg",
] as const;

let picked: number | null = null;

/** One random image per page load (stable between calls, as `useSyncExternalStore` requires). */
function pickImage(): number {
  picked ??= Math.floor(Math.random() * LOGIN_BACKGROUNDS.length);
  return picked;
}

const subscribe = () => () => {};
const serverSnapshot = () => null;

/**
 * Background photo of the login screen, faded into the page from the bottom edge. The image is chosen at random
 * on the client only: the server renders nothing (so `/login` stays static, with no image to download for it and
 * no flash of a different one), and once the page is there the single chosen file is fetched and fades in. The
 * browser downloads one image, as a CSS background (no `next/image`, so no use of the image optimization quota).
 */
export function LoginBackground() {
  const index = useSyncExternalStore(subscribe, pickImage, serverSnapshot);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-1/2 opacity-35"
    >
      {index !== null && (
        <div
          className="login-bg animate-fade-in h-full"
          style={{ backgroundImage: `url(${LOGIN_BACKGROUNDS[index]})` }}
        />
      )}
    </div>
  );
}
