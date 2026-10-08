"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, MapIcon, SettingsIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/calendar", label: "Calendrier", Icon: CalendarIcon },
  { href: "/map", label: "Carte", Icon: MapIcon },
  { href: "/settings", label: "Réglages", Icon: SettingsIcon },
] as const;

/**
 * Bottom navigation of the app (mobile first). Each item is at least 64 px tall (Android asks for 48 px,
 * iOS for 44 px), shows an icon above its label, and the bar keeps clear of the iPhone home indicator and of the Android
 * gesture / navigation bar with the `pb-safe-bottom` token (`env(safe-area-inset-bottom)`, at least 1 rem). The active section has an accent pill behind its icon.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-30 border-t border-line bg-background/90 pb-safe-bottom backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium transition-colors ${
                  active ? "text-accent" : "text-muted [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-accent/15" : ""
                  }`}
                >
                  <Icon className="h-6 w-6" />
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
