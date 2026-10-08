"use client";

import { useTransition } from "react";
import { refreshPublicData } from "@/features/refresh/actions";
import { RefreshIcon } from "./icons";

/**
 * "Actualiser" button of the header: the manual way to get the latest data now. The app keeps shared data for up
 * to 2 minutes and refreshes on return after a while away (see `RefreshOnReturn`); this expires that data and
 * re-renders the page. The icon spins until the new page is there.
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
      className="flex h-tap w-tap items-center justify-center rounded-full bg-foreground/5 text-foreground/80 transition-colors active:bg-foreground/15 [@media(hover:hover)]:hover:bg-foreground/10"
    >
      <RefreshIcon className={pending ? "animate-spin" : undefined} />
    </button>
  );
}
