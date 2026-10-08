"use client";

import { useActionState, useEffect, useRef } from "react";
import { useDialogClose, useInDialog } from "@/components/full-screen-dialog";
import { publishAnnouncement, type PublishState } from "./actions";
import { BODY_MAX, TITLE_MAX } from "./schema";

const INITIAL_STATE: PublishState = { status: "idle" };

/** Publish form, only rendered for users holding `announcement.publish` (the server re-checks). */
export function AnnouncementForm() {
  const [state, action, pending] = useActionState(publishAnnouncement, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const closeDialog = useDialogClose();
  const inDialog = useInDialog();

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      closeDialog();
    }
  }, [state, closeDialog]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <label className="field-label">
        Titre
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          placeholder="Ex. Rendez-vous place de la République"
          aria-invalid={state.fieldErrors?.title ? true : undefined}
          className="field"
        />
        {state.fieldErrors?.title && <span className="field-error">{state.fieldErrors.title}</span>}
      </label>

      <label className="field-label">
        Message
        <textarea
          name="body"
          required
          rows={8}
          maxLength={BODY_MAX}
          placeholder="Écris ton message…"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className="field"
        />
        {state.fieldErrors?.body && <span className="field-error">{state.fieldErrors.body}</span>}
      </label>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-feedback-error" : "text-feedback-success"}
        >
          {state.message}
        </p>
      )}

      <div className={inDialog ? "form-actions" : undefined}>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Publication…" : "Publier"}
        </button>
      </div>
    </form>
  );
}
