"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

/** One tab of the bar. */
export type ChipTab = {
  key: string;
  label: string;
  href: string;
  /** A small count shown after the label. */
  badge?: number;
  /** What the count counts, read to assistive technologies (` permissions`). */
  badgeLabel?: string;
};

/**
 * Tabs as rounded chips: a navigation between pages (links, so every tab is a real URL and nothing depends on
 * client state). The list scrolls sideways on a narrow screen, so the current tab is brought to the middle:
 * otherwise it could sit past the edge, out of sight.
 */
export function ChipTabs({
  label,
  tabs,
  activeKey,
}: {
  /** Accessible name of the navigation. */
  label: string;
  tabs: ChipTab[];
  activeKey: string;
}) {
  const list = useRef<HTMLUListElement>(null);
  const active = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const container = list.current;
    const item = active.current;
    if (!container || !item) return;
    container.scrollLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
  }, [activeKey]);

  return (
    <nav aria-label={label}>
      <ul
        ref={list}
        className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                className={`flex min-h-tap items-center gap-2 rounded-control border px-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line bg-surface text-muted [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      isActive ? "bg-accent/15" : "bg-foreground/10"
                    }`}
                  >
                    {tab.badge}
                    {tab.badgeLabel && <span className="sr-only"> {tab.badgeLabel}</span>}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
