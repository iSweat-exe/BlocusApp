"use client";

import { useActionState } from "react";
import { setEventFinished, type EventFormState } from "./actions";

const INITIAL_STATE: EventFormState = { status: "idle" };

/** "Marquer comme terminé" / "Rouvrir". Only rendered with `event.finish`; the server re-checks. */
export function FinishToggle({ id, finished }: { id: string; finished: boolean }) {
  const [state, action, pending] = useActionState(setEventFinished, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="finished" value={finished ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-3 font-medium disabled:opacity-60 ${
          finished ? "border border-foreground/20" : "bg-foreground text-background"
        }`}
      >
        {pending ? "…" : finished ? "Rouvrir l'événement" : "Marquer comme terminé"}
      </button>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-red-500">
          {state.message}
        </p>
      )}
    </form>
  );
}
