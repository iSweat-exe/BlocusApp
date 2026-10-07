"use client";

import { useActionState, useEffect, useRef } from "react";
import { useDialogClose } from "@/components/full-screen-dialog";
import { publishAnnouncement, type PublishState } from "./actions";
import { BODY_MAX, TITLE_MAX } from "./schema";

const INITIAL_STATE: PublishState = { status: "idle" };

/** Publish form, only rendered for users holding `announcement.publish` (the server re-checks). */
export function AnnouncementForm() {
  const [state, action, pending] = useActionState(publishAnnouncement, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const closeDialog = useDialogClose();

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      closeDialog();
    }
  }, [state, closeDialog]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <label className="field-label">
        Titre
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
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

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Publication…" : "Publier"}
      </button>
    </form>
  );
}
