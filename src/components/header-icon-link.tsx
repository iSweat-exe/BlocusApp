"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Round 44 px icon button of the header (a comfortable touch target on iPhone and Android). It carries
 * `aria-current` and an accent ring while the user is on its section. The accessible name is `label`.
 */
export function HeaderIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-red-500/15 text-red-500 ring-2 ring-red-500"
          : "bg-foreground/5 text-foreground/80 active:bg-foreground/15 [@media(hover:hover)]:hover:bg-foreground/10"
      }`}
    >
      {children}
    </Link>
  );
}
