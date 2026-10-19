"use client";

import { useTransition } from "react";
import { refreshPublicData } from "@/features/refresh/actions";
import { RefreshIcon } from "./icons";

/**
 * "Actualiser" button of the header: the manual way to get the latest data now. The app keeps shared data for up
 * to 2 minutes and refreshes on return after a while away (see `RefreshOnReturn`); this expires that data and
 * re-renders the page. The icon spins, and the button stays disabled, until the new page is there: the transition
 * must return the action's promise, otherwise `pending` ends at once and the button could be pressed again while
 * a refresh is still running.
 */
export function RefreshButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => refreshPublicData())}
      disabled={pending}
      aria-label="Actualiser"
      title="Actualiser"
      aria-busy={pending}
      className="flex h-tap w-tap items-center justify-center rounded-control border border-line-strong/60 bg-surface/80 text-foreground/80 backdrop-blur-xs shadow-2xs transition-[scale,background-color,opacity] active:scale-[0.96] active:bg-foreground/15 disabled:opacity-70 [@media(hover:hover)]:hover:bg-foreground/10"
    >
      <RefreshIcon className={pending ? "animate-spin" : undefined} />
    </button>
  );
}
