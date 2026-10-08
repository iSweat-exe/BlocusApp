"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSheetSwipe } from "./use-sheet-swipe";

/** One choice of a {@link Select}. */
export type SelectOption = { value: string; label: string };

type Props = {
  /** Accessible name of the control (there is no visible `<label>` association with a custom widget). */
  label: string;
  options: readonly SelectOption[];
  /** Form field name: the selected value is submitted through a hidden input. */
  name?: string;
  /** Initial value when uncontrolled. Falls back to the first option. */
  defaultValue?: string;
  /** Controlled value. */
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Extra classes for the wrapper (width, flex…). */
  className?: string;
  /** Compact variant for inline use inside list rows. */
  size?: "md" | "sm";
};

/**
 * Reusable dropdown with a mobile-app look: a bottom sheet on phones (swipe down to dismiss, like iOS),
 * a popover from `sm` up.
 * Works inside forms (hidden input + `name`), controlled or not, and is keyboard accessible
 * (arrows, Home/End, Enter/Space, Escape) following the listbox pattern.
 */
export function Select({
  label,
  options,
  name,
  defaultValue,
  value,
  onChange,
  disabled = false,
  className = "",
  size = "md",
}: Props) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const selected = options.find((option) => option.value === current) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === current),
      ),
    );
    setOpen(true);
  };
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  useSheetSwipe({ active: open, sheetRef, backdropRef, scrollRef: listRef, onDismiss: close });
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (value === undefined) setInner(option.value);
    onChange?.(option.value);
    close();
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        setActive((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(last);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
        close();
        break;
      case "Tab":
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  const height = size === "sm" ? "min-h-control-sm text-sm" : "min-h-control text-base";

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={selected?.value ?? ""} />}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        className={`flex w-full items-center justify-between gap-2 rounded-control border border-line-strong bg-background px-4 text-left font-medium active:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 ${height}`}
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div
            ref={backdropRef}
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 z-40 animate-fade-in bg-black/40 sm:animate-none sm:bg-transparent"
          />
          <div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up rounded-t-sheet border border-line bg-background p-3 pb-safe-bottom shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:min-w-full sm:animate-none sm:rounded-control sm:p-1"
          >
            <div aria-hidden="true" className="-mt-1 flex justify-center pb-3 pt-1 sm:hidden">
              <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
            </div>
            <p className="section-title pb-2 sm:hidden">{label}</p>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onListKeyDown}
              className="max-h-[50dvh] overflow-y-auto outline-none"
            >
              {options.map((option, index) => {
                const isSelected = option.value === current;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(index)}
                    className={`flex min-h-control cursor-pointer items-center justify-between gap-3 rounded-control px-4 py-2 text-base sm:min-h-control-sm sm:whitespace-nowrap sm:text-sm ${
                      index === active ? "bg-foreground/10" : ""
                    } ${isSelected ? "font-semibold" : ""}`}
                  >
                    {option.label}
                    {isSelected && (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="shrink-0 text-accent"
                      >
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
