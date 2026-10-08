"use client";

import { useSyncExternalStore } from "react";
import { THEMES, type Theme } from "./theme";
import { readServerTheme, readTheme, subscribeToTheme, writeTheme } from "./theme-store";

const ICONS: Record<Theme, React.ReactNode> = {
  // Half-filled circle: follows the device.
  system: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
};

/**
 * Theme settings as an iOS-style segmented control: System, Light, Dark. The choice is stored on this
 * device and applied immediately to the whole app.
 */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribeToTheme, readTheme, readServerTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="grid grid-cols-3 gap-1 rounded-card border border-line bg-surface p-1"
    >
      {THEMES.map(({ value, label }) => {
        const selected = value === current;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => writeTheme(value)}
            className={`flex min-h-control flex-col items-center justify-center gap-1 rounded-control py-2 text-xs font-medium ${
              selected ? "bg-background text-accent shadow-sm" : "text-muted active:bg-foreground/5"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              {ICONS[value]}
            </svg>
            {label}
          </button>
        );
      })}
    </div>
  );
}
