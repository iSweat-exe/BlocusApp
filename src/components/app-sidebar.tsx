"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, NAV_ITEMS } from "./nav-items";

/** Small links under the sections: discreet, never in the way of the navigation. */
const FOOTER_LINKS = [
  { href: "/credits", label: "Crédits" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu", label: "Conditions" },
] as const;

/** Space reserved for the sidebar while it loads, so the content does not jump when it appears. */
export function AppSidebarFallback() {
  return <div aria-hidden="true" className="hidden w-64 shrink-0 border-r border-line lg:block" />;
}

/**
 * Navigation of the app on a desktop (from 1024 px): a sidebar that stays in view, with the brand, the four sections
 * as large rows (icon, label, the current one tinted and marked) and discreet links at the bottom. It replaces the
 * bottom bar of the phone (`AppNav`, hidden from this width). The account actions (refresh, administration, profile)
 * stay in the top bar. Needs a Suspense boundary: `usePathname()` on routes with dynamic segments.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-background px-4 py-6 lg:flex">
      <Link
        href="/"
        prefetch={false}
        className="inline-flex min-h-tap items-center rounded-control px-3 font-display text-2xl font-extrabold tracking-tighter text-foreground"
      >
        BLOCUS
        <span aria-hidden="true" className="text-accent">
          .
        </span>
      </Link>

      <nav aria-label="Navigation principale">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-tap items-center gap-3 rounded-control px-3 text-sm transition-colors ${
                    active
                      ? "bg-accent/10 font-semibold text-accent"
                      : "font-medium text-muted [@media(hover:hover)]:hover:bg-foreground/5 [@media(hover:hover)]:hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="Informations" className="mt-auto">
        <ul className="flex flex-wrap gap-x-1 gap-y-0.5">
          {FOOTER_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={isActivePath(pathname, href) ? "page" : undefined}
                className="inline-flex min-h-8 items-center rounded-control px-3 text-xs text-faint transition-colors [@media(hover:hover)]:hover:text-foreground aria-[current=page]:text-foreground"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
