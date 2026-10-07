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

const DialogContext = createContext<{ close: () => void } | null>(null);
const noop = () => {};

/**
 * Closes the surrounding {@link FullScreenDialog} (a no-op outside one). Lets a form that is passed as
 * `children` from a Server Component close the dialog after a successful submit, without function props.
 */
export function useDialogClose(): () => void {
  return useContext(DialogContext)?.close ?? noop;
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

const DEFAULT_TRIGGER =
  "w-full rounded-xl bg-red-500 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-red-600";

/**
 * A button that opens a dialog covering the whole viewport (native `<dialog>`: focus trap, Escape to close,
 * focus restored on close). The content is only mounted while open, so every opening starts from a clean
 * form. Safe-area aware on iPhone; works the same on Android and desktop.
 */
export function FullScreenDialog({ triggerLabel, title, triggerClassName, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  };
  // Stable identities: forms call `close` from an effect and must not re-run it on every render.
  const close = useCallback(() => dialogRef.current?.close(), []);
  const contextValue = useMemo(() => ({ close }), [close]);

  return (
    <>
      <button type="button" onClick={show} className={triggerClassName ?? DEFAULT_TRIGGER}>
        {triggerLabel}
      </button>

      {/* `onClose` also fires for Escape and the Android back gesture. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-background p-0 text-foreground backdrop:bg-black/50"
      >
        <DialogContext.Provider value={contextValue}>
          <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
            <header className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none active:bg-foreground/10"
              >
                ×
              </button>
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              {open && children}
            </div>
          </div>
        </DialogContext.Provider>
      </dialog>
    </>
  );
}
