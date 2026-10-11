"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import type { RoleOverview } from "./role-matrix-model";

/**
 * Roles of the page, one tap each, with how many permissions each holds. Links (not client state): the page
 * stays shareable and every role is a real URL. The list scrolls sideways on a narrow screen, so the chosen
 * role is brought to the middle: otherwise it could sit past the edge, out of sight.
 */
export function RoleSelector({
  roles,
  selectedKey,
}: {
  roles: RoleOverview[];
  selectedKey: string;
}) {
  const list = useRef<HTMLUListElement>(null);
  const active = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const container = list.current;
    const item = active.current;
    if (!container || !item) return;
    container.scrollLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
  }, [selectedKey]);

  return (
    <nav aria-label="Rôles">
      <ul
        ref={list}
        className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {roles.map((role) => {
          const isActive = role.key === selectedKey;
          return (
            <li key={role.key} ref={isActive ? active : undefined} className="shrink-0">
              <Link
                href={`/admin/roles?role=${role.key}`}
                prefetch={false}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-tap items-center gap-2 rounded-control border px-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line bg-surface text-muted [@media(hover:hover)]:hover:text-foreground"
                }`}
              >
                {role.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    isActive ? "bg-accent/15" : "bg-foreground/10"
                  }`}
                >
                  {role.grantedCount}
                  <span className="sr-only"> permissions</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
