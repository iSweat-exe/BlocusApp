"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { VIEW_OPTIONS, type CalendarViewMode, type ViewOption } from "./calendar-types";

export function ViewSwitcher({
  currentView,
  onChangeView,
}: {
  currentView: CalendarViewMode;
  onChangeView: (view: CalendarViewMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption = VIEW_OPTIONS.find((opt) => opt.id === currentView) ?? VIEW_OPTIONS[0]!;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectOption = (option: ViewOption) => {
    onChangeView(option.id);
    setIsOpen(false);
  };

  const ActiveIcon = activeOption.Icon;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Changer de vue (actuelle : ${activeOption.label})`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-tap w-tap items-center justify-center rounded-control border border-foreground/10 bg-foreground/5 text-foreground transition-all hover:bg-foreground/10 active:scale-95"
      >
        <ActiveIcon className="size-5" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Vues du calendrier"
          style={{
            backgroundColor: "color-mix(in srgb, var(--foreground) 8%, var(--background))",
          }}
          className="absolute right-0 top-full z-30 mt-1.5 min-w-[150px] rounded-control border border-line-strong bg-background p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {VIEW_OPTIONS.map((option) => {
            const OptionIcon = option.Icon;
            const isSelected = option.id === currentView;
            return (
              <button
                key={option.id}
                role="menuitem"
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => selectOption(option)}
                className={`flex w-full items-center justify-between rounded-control px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-foreground/15 text-foreground font-semibold"
                    : "text-foreground font-medium hover:bg-foreground/10 active:bg-foreground/15"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <OptionIcon
                    className={`size-4 shrink-0 ${isSelected ? "text-accent" : "text-muted"}`}
                  />
                  <span>{option.label}</span>
                </div>
                {isSelected && <CheckIcon className="size-3.5 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
