"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 44 px icon button of the header, with the rounded-square shape of the controls (a comfortable touch target
 * on iPhone and Android). It carries `aria-current` and an accent border while the user is on its section. The
 * accessible name is `label`. `overflow-hidden` clips a picture (the avatar) to the rounded corners.
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
      className={`flex h-tap w-tap items-center justify-center overflow-hidden rounded-control border transition-[scale,color,background-color,border-color] active:scale-[0.96] ${
        active
          ? "border-accent/40 bg-accent/15 text-accent shadow-2xs"
          : "border-line-strong/60 bg-surface/80 text-foreground/80 backdrop-blur-xs shadow-2xs active:bg-foreground/15 [@media(hover:hover)]:hover:bg-foreground/10"
      }`}
    >
      {children}
    </Link>
  );
}
