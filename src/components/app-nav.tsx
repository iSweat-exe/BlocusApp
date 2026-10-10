"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, MapIcon, SettingsIcon } from "./icons";

/** Duration of the longest tap animation (`--animate-*` tokens in `globals.css`), plus a margin. */
const ANIMATION_MS = 600;

const ITEMS = [
  { href: "/", label: "Accueil", Icon: HomeIcon, animClass: "animate-home-bounce" },
  { href: "/calendar", label: "Calendrier", Icon: CalendarIcon, animClass: "animate-calendar-pop" },
  { href: "/map", label: "Carte", Icon: MapIcon, animClass: "animate-map-fold" },
  { href: "/settings", label: "Réglages", Icon: SettingsIcon, animClass: "animate-gear-spin" },
] as const;

/**
 * Bottom navigation of the app (mobile first). Each item is at least 64 px tall (Android asks for 48 px,
 * iOS for 44 px), shows an icon above its label, and the bar keeps clear of the iPhone home indicator and of the
 * Android gesture / navigation bar with the `pb-safe-bottom` token (`env(safe-area-inset-bottom)`, at least
 * 2 rem). The active section has an accent pill behind its icon. Tapping an item plays a short animation on its
 * icon (it is skipped for people who asked for reduced motion, see `globals.css`).
 */
export function AppNav() {
  const pathname = usePathname();
  const [animatingHref, setAnimatingHref] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleTap = (href: string) => {
    if (timer.current) clearTimeout(timer.current);
    setAnimatingHref(href);
    timer.current = setTimeout(() => setAnimatingHref(null), ANIMATION_MS);
  };

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-30 border-t border-line bg-background/90 pb-safe-bottom backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ href, label, Icon, animClass }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isAnimating = animatingHref === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => handleTap(href)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium transition-all active:scale-95 ${
                  active
                    ? "font-semibold text-accent"
                    : "text-muted [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-control border transition-all ${
                    active
                      ? "scale-105 border-accent/30 bg-accent/15 text-accent shadow-2xs"
                      : "border-transparent bg-transparent text-foreground opacity-60 [@media(hover:hover)]:hover:border-line-strong/40 [@media(hover:hover)]:hover:bg-surface/50 [@media(hover:hover)]:hover:opacity-100"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isAnimating ? animClass : ""}`} />
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
