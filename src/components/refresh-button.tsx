"use client";

import { useState, useTransition } from "react";
import { refreshPublicData } from "@/features/refresh/actions";
import { RefreshIcon } from "./icons";

/**
 * "Actualiser" button of the header: the manual way to get the latest data now.
 * The icon spins smoothly when pressed and re-renders the page with fresh data.
 */
export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = () => {
    setIsSpinning(true);
    setTimeout(() => setIsSpinning(false), 650);
    startTransition(() => {
      void refreshPublicData();
    });
  };

  const active = pending || isSpinning;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={active}
      aria-label="Actualiser"
      title="Actualiser"
      aria-busy={active}
      className="flex h-tap w-tap items-center justify-center rounded-control border border-line-strong/60 bg-surface/80 text-foreground/80 backdrop-blur-xs shadow-2xs transition-all active:scale-95 active:bg-foreground/15 [@media(hover:hover)]:hover:bg-foreground/10 disabled:opacity-70"
    >
      <RefreshIcon className={active ? "animate-spin" : undefined} />
    </button>
  );
}
