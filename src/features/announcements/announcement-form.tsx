"use client";

import { useActionState, useEffect, useRef } from "react";
import { publishAnnouncement, type PublishState } from "./actions";
import { BODY_MAX, TITLE_MAX } from "./schema";

const INITIAL_STATE: PublishState = { status: "idle" };

/** Publish form, only rendered for users holding `announcement.publish` (the server re-checks). */
export function AnnouncementForm() {
  const [state, action, pending] = useActionState(publishAnnouncement, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4"
    >
      <h2 className="font-semibold">Publier une annonce</h2>

      <label className="flex flex-col gap-1 text-sm">
        Titre
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          aria-invalid={state.fieldErrors?.title ? true : undefined}
          className="rounded border border-foreground/20 bg-background px-3 py-2 text-base"
        />
        {state.fieldErrors?.title && (
          <span className="text-red-500">{state.fieldErrors.title}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea
          name="body"
          required
          rows={4}
          maxLength={BODY_MAX}
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className="rounded border border-foreground/20 bg-background px-3 py-2 text-base"
        />
        {state.fieldErrors?.body && <span className="text-red-500">{state.fieldErrors.body}</span>}
      </label>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-sm text-red-500" : "text-sm text-green-600"}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-red-500 px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Publication…" : "Publier"}
      </button>
    </form>
  );
}
