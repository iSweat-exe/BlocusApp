"use client";

import { useActionState, useState } from "react";
import { deleteMyAccount, type DeleteAccountState } from "./actions";
import { DELETE_CONFIRMATION, isDeleteConfirmed } from "./my-data";

const INITIAL_STATE: DeleteAccountState = { status: "idle" };

/**
 * Account deletion, in two steps so that it cannot happen by a stray tap: a button reveals the form, and the
 * red button only works once the confirmation word is typed. The server checks the word again.
 */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteMyAccount, INITIAL_STATE);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-danger w-full">
        Supprimer mon compte
      </button>
    );
  }

  return (
    <form action={action} className="card flex flex-col gap-3 border-danger/40 p-4">
      <p className="text-sm">
        <strong>Cette action est définitive.</strong> Ton profil, tes réactions, tes abonnements aux
        notifications et tes photos de posts seront effacés. Les posts, événements et positions que
        tu as publiés restent, sans plus être rattachés à toi.
      </p>
      <label className="field-label">
        Écris {DELETE_CONFIRMATION} pour confirmer
        <input
          name="confirmation"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="field"
        />
      </label>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-feedback-error">
          {state.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="btn btn-outline flex-1"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending || !isDeleteConfirmed(typed)}
          className="btn btn-danger flex-1 font-semibold"
        >
          {pending ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </form>
  );
}
