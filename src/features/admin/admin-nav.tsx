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
      <ul className="flex gap-2 overflow-x-auto">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`block whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
                isActive(href) ? "bg-red-500 text-white" : "bg-foreground/10"
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
