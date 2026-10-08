"use client";

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

  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
    // Start on the content, not on the close button (which would show a focus ring right away).
    contentRef.current?.focus({ preventScroll: true });
  };
  // Stable identities: forms call `close` from an effect and must not re-run it on every render.
  const close = useCallback(() => dialogRef.current?.close(), []);
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
        onClose={() => {
          setOpen(false);
          // A swipe leaves the sheet translated: reset it for the next opening.
          if (sheetRef.current) {
            sheetRef.current.style.transform = "";
            sheetRef.current.style.transition = "";
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-transparent p-0 text-foreground backdrop:bg-black/50"
      >
        <DialogContext.Provider value={contextValue}>
          <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] mx-auto flex w-full max-w-2xl animate-sheet-up flex-col overflow-hidden rounded-t-sheet border border-b-0 border-line bg-background shadow-2xl"
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
