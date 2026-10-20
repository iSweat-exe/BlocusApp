"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { CloseIcon } from "@/components/icons";
import { Rise } from "@/components/rise";
import {
  readOnboardingDone,
  readServerOnboardingDone,
  subscribeToOnboarding,
} from "@/features/onboarding/onboarding-store";
import { PATCH_NOTES, type PatchNote } from "./patch-notes";
import { ChangeList, formatPatchDate } from "./patch-notes-view";
import {
  markWhatsNewSeen,
  readServerWhatsNewSeen,
  readWhatsNewSeen,
  subscribeToWhatsNew,
  WHATS_NEW_BLOCKED,
} from "./whats-new-store";

/** What to do with the "what's new" screen on this device. */
export type WhatsNewAction = "show" | "silent" | "hide";

/**
 * Decides whether to show the newest entry.
 * - Already seen (or the storage is unusable): hide. Someone away for a long time still gets **one** screen, the
 *   newest entry, because only the newest date is compared and stored.
 * - A new device has nothing to catch up on (what it sees is already the current state): the entry is recorded
 *   silently, so only the next update shows. The exception is a signed-in person who finished the onboarding
 *   before this screen existed: the device has no date yet but they know the app, so they get it once.
 * - A signed-in person still in the onboarding waits for it to end (never two full-screen sheets at once).
 * @param latest - Date of the newest patch note.
 * @param seen - Date stored on the device, `null` when none, or the blocked marker.
 * @param context - Whether the person is signed in and whether the onboarding is done on this device.
 */
export function decideWhatsNew(
  latest: string,
  seen: string | null,
  context: { signedIn: boolean; onboardingDone: boolean },
): WhatsNewAction {
  if (seen === WHATS_NEW_BLOCKED) return "hide";
  if (seen !== null && seen >= latest) return "hide";
  if (context.signedIn && !context.onboardingDone) return seen === null ? "silent" : "hide";
  if (seen === null && !context.signedIn) return "silent";
  return "show";
}

function Sheet({ note }: { note: PatchNote }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dismiss = () => markWhatsNewSeen(note.date);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="whats-new-title"
      // Escape and the Android back gesture close it, like the cross.
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col bg-background p-0 text-foreground backdrop:bg-black/50 open:flex open:animate-fade-in lg:items-center lg:justify-center lg:bg-transparent"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col lg:h-[40rem] lg:max-h-[90dvh] lg:flex-none lg:overflow-hidden lg:rounded-sheet lg:border lg:border-line lg:bg-background lg:shadow-2xl">
        <header className="flex items-center justify-between gap-4 px-gutter pt-[max(env(safe-area-inset-top),0.5rem)]">
          <p className="text-sm font-semibold text-muted">
            Mise à jour du <time dateTime={note.date}>{formatPatchDate(note.date)}</time>
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="-mr-2.5 flex h-tap w-tap items-center justify-center rounded-control text-muted transition-[scale,color] active:scale-[0.96] [@media(hover:hover)]:hover:text-foreground"
          >
            <CloseIcon className="size-6" />
          </button>
        </header>

        {/* Infrequent screen: the title, the changes and the link rise one after the other (see `Rise`). */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-gutter py-6">
          <Rise order={0}>
            <h2
              id="whats-new-title"
              ref={headingRef}
              tabIndex={-1}
              data-focus-silent
              className="font-display text-3xl font-extrabold tracking-tight"
            >
              {note.title}
            </h2>
          </Rise>
          <Rise order={1}>
            <ChangeList changes={note.changes} />
          </Rise>
          <Rise order={2}>
            {/* min-h-tap: a text link alone is far under the 44 px a thumb needs. */}
            <Link
              href="/patch-notes"
              prefetch={false}
              onClick={dismiss}
              className="-my-2 inline-flex min-h-tap items-center text-sm font-medium text-accent"
            >
              Voir tout l&apos;historique
            </Link>
          </Rise>
        </div>

        <footer className="border-t border-line px-gutter pt-3 pb-safe-bottom">
          <button type="button" onClick={dismiss} className="btn btn-primary w-full">
            Continuer
          </button>
        </footer>
      </div>
    </dialog>
  );
}

/**
 * Full-screen "what's new" shown once after an update: the date and a cross at the top, the newest patch note in
 * the middle, "Continuer" at the bottom. The cross, the button, Escape and the history link all mark it as seen on
 * this device (see `whats-new-store.ts`). Renders nothing on the server and when there is nothing to show.
 * @param signedIn - Whether the person has an account (a signed-in newcomer sees the onboarding first).
 * @param notes - The patch notes, newest first (defaults to the application's own).
 */
export function WhatsNew({
  signedIn,
  notes = PATCH_NOTES,
}: {
  signedIn: boolean;
  notes?: readonly PatchNote[];
}) {
  const seen = useSyncExternalStore(subscribeToWhatsNew, readWhatsNewSeen, readServerWhatsNewSeen);
  const onboardingDone = useSyncExternalStore(
    subscribeToOnboarding,
    readOnboardingDone,
    readServerOnboardingDone,
  );
  const latest = notes[0];
  const action = latest ? decideWhatsNew(latest.date, seen, { signedIn, onboardingDone }) : "hide";

  useEffect(() => {
    if (action === "silent" && latest) markWhatsNewSeen(latest.date);
  }, [action, latest]);

  if (action !== "show" || !latest) return null;
  return <Sheet note={latest} />;
}
