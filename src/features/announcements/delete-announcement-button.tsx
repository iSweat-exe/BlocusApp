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
        className="inline-flex min-h-tap items-center gap-1.5 rounded-control px-3 text-sm text-muted active:bg-foreground/10 [@media(hover:hover)]:hover:text-danger"
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
        className="btn btn-sm font-medium active:bg-foreground/10"
      >
        Annuler
      </button>
      <button type="submit" className="btn btn-primary btn-sm">
        Confirmer la suppression
      </button>
    </form>
  );
}
