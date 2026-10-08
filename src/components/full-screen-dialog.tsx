"use client";

import { flushSync } from "react-dom";
import {
  createContext,
  useCallback,
  useMemo,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useSheetSwipe } from "./use-sheet-swipe";

const DialogContext = createContext<{ close: () => void } | null>(null);
const noop = () => {};

const SHEET_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 320;
const CLOSE_MS = 220;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Slides the sheet and fades the backdrop with the Web Animations API: started explicitly right after the
 * dialog is shown (no dependency on a CSS animation restarting when `<dialog>` toggles `display`, which iOS
 * Safari skips or delays when the first frame is busy). Resolves once finished; returns `null` where the
 * API is missing (tests) or the user asks for reduced motion.
 */
function runSheetAnimation(
  dialog: HTMLDialogElement,
  sheet: HTMLElement,
  direction: "in" | "out",
): Promise<void> | null {
  if (typeof sheet.animate !== "function" || prefersReducedMotion()) return null;
  const opening = direction === "in";
  const options = {
    duration: opening ? OPEN_MS : CLOSE_MS,
    easing: opening ? SHEET_EASING : "ease-in",
    fill: "both" as const,
  };
  try {
    dialog.animate(
      { opacity: opening ? [0, 1] : [1, 0] },
      { ...options, easing: "ease-out", pseudoElement: "::backdrop" },
    );
  } catch {
    // Backdrop animation unsupported: the sheet alone still slides.
  }
  // Closing keeps the current position as its start, so a sheet already dragged down continues from there.
  const keyframes = opening
    ? [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }]
    : [{ transform: "translateY(100%)" }];
  return sheet.animate(keyframes, options).finished.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Closes the surrounding {@link FullScreenDialog} (a no-op outside one). Lets a form that is passed as
 * `children` from a Server Component close the dialog after a successful submit, without function props.
 */
export function useDialogClose(): () => void {
  return useContext(DialogContext)?.close ?? noop;
}

/** Whether the caller is rendered inside a {@link FullScreenDialog} (forms use it to pin their actions). */
export function useInDialog(): boolean {
  return useContext(DialogContext) !== null;
}

type Props = {
  /** Text of the button that opens the dialog. */
  triggerLabel: string;
  /** Title shown in the header of the dialog (also its accessible name). */
  title: string;
  /** Extra classes for the trigger button (defaults to a full-width accent button). */
  triggerClassName?: string;
  children: ReactNode;
};

const DEFAULT_TRIGGER = "btn btn-primary w-full shadow-sm";

/**
 * A button that opens a sheet covering the screen below the status bar, like a native modal: rounded top
 * corners, a grabber, a dimmed backdrop, a slide-up animation, and **swipe down to dismiss** (from the header,
 * or from the content when it is scrolled to the top). Native `<dialog>`: focus trap, Escape and the Android
 * back gesture close it, focus is restored on close. The content is only mounted while open, so every opening
 * starts from a clean form. Safe-area aware on iPhone; a centered panel on larger screens.
 */
export function FullScreenDialog({ triggerLabel, title, triggerClassName, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  // Keep the page behind from scrolling while the dialog is open (iOS lets it scroll otherwise).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const closingRef = useRef(false);

  const show = () => {
    const dialog = dialogRef.current;
    const sheet = sheetRef.current;
    if (!dialog || !sheet) return;
    closingRef.current = false;
    // Mount the content while the dialog is still hidden, so the (possibly heavy) form is already laid out
    // when the slide-up starts and the animation does not stutter.
    flushSync(() => setOpen(true));
    dialog.showModal();
    void runSheetAnimation(dialog, sheet, "in");
    // Start on the content, not on the close button (which would show a focus ring right away).
    contentRef.current?.focus({ preventScroll: true });
  };
  // Slides the sheet away, then closes the dialog. Stable identity: forms call `close` from an effect and
  // must not re-run it on every render.
  const close = useCallback(() => {
    const dialog = dialogRef.current;
    const sheet = sheetRef.current;
    if (!dialog || !dialog.open || closingRef.current) return;
    closingRef.current = true;
    if (!sheet) {
      dialog.close();
      return;
    }
    const sliding = runSheetAnimation(dialog, sheet, "out");
    if (sliding) void sliding.then(() => dialog.close());
    else dialog.close();
  }, []);
  const contextValue = useMemo(() => ({ close }), [close]);
  useSheetSwipe({
    active: open,
    sheetRef,
    backdropRef: { current: null },
    scrollRef: contentRef,
    onDismiss: close,
  });

  return (
    <>
      <button type="button" onClick={show} className={triggerClassName ?? DEFAULT_TRIGGER}>
        {triggerLabel}
      </button>

      {/* `onClose` also fires for Escape and the Android back gesture. A tap on the dimmed strip closes. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Escape and the Android back gesture: slide away instead of vanishing.
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setOpen(false);
          closingRef.current = false;
          // A swipe leaves the sheet translated and the closing animation holds its end state: reset both
          // for the next opening.
          const sheet = sheetRef.current;
          if (sheet) {
            sheet.getAnimations?.().forEach((animation) => animation.cancel());
            sheet.style.transform = "";
            sheet.style.transition = "";
          }
          dialogRef.current
            ?.getAnimations?.({ subtree: true })
            .forEach((animation) => animation.cancel());
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-transparent p-0 text-foreground backdrop:bg-black/50"
      >
        <DialogContext.Provider value={contextValue}>
          <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-sheet border border-b-0 border-line bg-background shadow-2xl"
          >
            <header className="flex flex-col border-b border-line">
              <div aria-hidden="true" className="flex justify-center pb-1 pt-2">
                <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fermer"
                  className="flex h-tap w-tap shrink-0 items-center justify-center rounded-full bg-foreground/10 active:bg-foreground/15"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </header>
            <div
              ref={contentRef}
              tabIndex={-1}
              className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4 outline-none [&>form]:flex-1"
            >
              {open && children}
            </div>
          </div>
        </DialogContext.Provider>
      </dialog>
    </>
  );
}
