"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A section of the admin area. */
export type AdminLink = { href: string; label: string };

/** Sub-navigation of the admin area; the current section is marked with `aria-current`. */
export function AdminNav({ links }: { links: AdminLink[] }) {
  const pathname = usePathname();
  // The user pages belong to the "Utilisateurs" section.
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" || pathname.startsWith("/admin/users")
      : pathname.startsWith(href);

  return (
    <nav aria-label="Sections de l'administration">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              prefetch={false}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex min-h-control-sm items-center whitespace-nowrap rounded-full px-5 text-sm font-medium ${
                isActive(href)
                  ? "bg-accent text-accent-ink shadow-sm"
                  : "bg-foreground/10 active:bg-foreground/15"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
