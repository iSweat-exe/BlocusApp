"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

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
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 500);
  };

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={handleClick}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-tap w-tap items-center justify-center rounded-control border transition-all active:scale-95 ${
        active
          ? "border-accent/40 bg-accent/15 text-accent shadow-2xs"
          : "border-line-strong/60 bg-surface/80 text-foreground/80 backdrop-blur-xs shadow-2xs active:bg-foreground/15 [@media(hover:hover)]:hover:bg-foreground/10"
      }`}
    >
      <span
        className={
          animating
            ? "animate-[icon-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center"
            : "flex items-center justify-center"
        }
      >
        {children}
      </span>
    </Link>
  );
}
