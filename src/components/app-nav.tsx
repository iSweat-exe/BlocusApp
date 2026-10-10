"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, MapIcon, SettingsIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Accueil", Icon: HomeIcon, animClass: "animate-home-bounce" },
  { href: "/calendar", label: "Calendrier", Icon: CalendarIcon, animClass: "animate-calendar-pop" },
  { href: "/map", label: "Carte", Icon: MapIcon, animClass: "animate-map-fold" },
  { href: "/settings", label: "Réglages", Icon: SettingsIcon, animClass: "animate-gear-spin" },
] as const;

/**
 * Bottom navigation of the app (mobile first) styled with login UI pill buttons and icon-specific click animations.
 */
export function AppNav() {
  const pathname = usePathname();
  const [animatingHref, setAnimatingHref] = useState<string | null>(null);

  const handleTap = (href: string) => {
    setAnimatingHref(href);
    setTimeout(() => {
      setAnimatingHref(null);
    }, 600);
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
                    ? "text-accent font-semibold"
                    : "text-muted [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-control border transition-all ${
                    active
                      ? "border-accent/30 bg-accent/15 text-accent shadow-2xs scale-105"
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
