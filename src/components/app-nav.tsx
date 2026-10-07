"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/calendar", label: "Calendrier" },
  { href: "/map", label: "Carte" },
] as const;

/** Bottom navigation bar of the authenticated app (mobile-first, iOS safe-area aware). */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 border-t border-foreground/10 bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block py-3 text-center text-sm ${
                  active ? "font-semibold text-red-500" : "text-foreground/60"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
