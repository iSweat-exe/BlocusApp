"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** One tab of the bar. */
export type ChipTab = {
  key: string;
  label: string;
  href: string;
  /** A small icon before the label (decorative: the label names the tab). */
  icon?: ReactNode;
  /** A small count shown after the label. */
  badge?: number;
  /** What the count counts, read to assistive technologies (` permissions`). */
  badgeLabel?: string;
};

/**
 * A navigation between pages, as links (so every tab is a real URL and nothing depends on client state).
 * `chips` is a filter inside a page (rounded outlined chips); `underline` is the main navigation of a section
 * (flat tabs on a rule, the current one underlined in the accent color). The list scrolls sideways on a
 * narrow screen, so the current tab is brought to the middle: otherwise it could sit past the edge.
 */
export function ChipTabs({
  label,
  tabs,
  activeKey,
  variant = "chips",
}: {
  /** Accessible name of the navigation. */
  label: string;
  tabs: ChipTab[];
  activeKey: string;
  variant?: "chips" | "underline";
}) {
  const list = useRef<HTMLUListElement>(null);
  const active = useRef<HTMLLIElement>(null);
  const underline = variant === "underline";

  useLayoutEffect(() => {
    const container = list.current;
    const item = active.current;
    if (!container || !item) return;
    container.scrollLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
  }, [activeKey]);

  return (
    <nav aria-label={label} className={underline ? "-mx-4 border-b border-line" : undefined}>
      <ul
        ref={list}
        className={`relative flex overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          underline ? "gap-1" : "-mx-4 gap-2 pb-1"
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <li key={tab.key} ref={isActive ? active : undefined} className="shrink-0">
              <Link
                href={tab.href}
                prefetch={false}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={
                  underline
                    ? `relative flex min-h-tap items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "text-foreground"
                          : "text-muted [@media(hover:hover)]:hover:text-foreground"
                      }`
                    : `flex min-h-tap items-center gap-2 rounded-control border px-4 text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-line bg-surface text-muted [@media(hover:hover)]:hover:text-foreground"
                      }`
                }
              >
                {tab.icon && (
                  <span aria-hidden="true" className={isActive && underline ? "text-accent" : ""}>
                    {tab.icon}
                  </span>
                )}
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      isActive && !underline ? "bg-accent/15" : "bg-foreground/10"
                    }`}
                  >
                    {tab.badge}
                    {tab.badgeLabel && <span className="sr-only"> {tab.badgeLabel}</span>}
                  </span>
                )}
                {underline && isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
