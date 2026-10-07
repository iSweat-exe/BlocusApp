"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { deleteAnnouncement } from "./actions";

/**
 * Delete control of an announcement: a discreet button first, then an explicit "Confirmer" so a stray tap
 * on a phone cannot remove a post. Only rendered for users allowed to delete (the server re-checks).
 */
export function DeleteAnnouncementButton({ id, title }: { id: string; title: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Supprimer l'annonce « ${title} »`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-foreground/60 active:bg-foreground/10 [@media(hover:hover)]:hover:text-red-500"
      >
        <TrashIcon className="h-4 w-4" />
        Supprimer
      </button>
    );
  }

  return (
    <form action={deleteAnnouncement} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-lg px-3 text-sm active:bg-foreground/10"
      >
        Annuler
      </button>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white active:bg-red-600"
      >
        Confirmer la suppression
      </button>
    </form>
  );
}
