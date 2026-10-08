"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarIcon } from "@/components/icons";
import { useDialogClose, useInDialog } from "@/components/full-screen-dialog";
import { createEvent, updateEvent, type EventFormState } from "./actions";
import { DESCRIPTION_MAX, LOCATION_MAX, TITLE_MAX } from "./schema";
import { formatDayKeyLong } from "./time";

const INITIAL_STATE: EventFormState = { status: "idle" };
const inputClass = "field";

/** Values of an existing event, as shown in the edit form (wall-clock time in the event zone). */
export type EventFormDefaults = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  endTime: string;
};

type Props = { mode: "create"; day: string } | { mode: "edit"; defaults: EventFormDefaults };

/** Create / edit form. Only rendered for users with `event.create`; the server re-checks everything. */
export function EventForm(props: Props) {
  const edit = props.mode === "edit" ? props.defaults : null;
  const [state, action, pending] = useActionState(
    props.mode === "create" ? createEvent : updateEvent,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const closeDialog = useDialogClose();
  const inDialog = useInDialog();

  useEffect(() => {
    if (state.status === "success" && props.mode === "create") {
      formRef.current?.reset();
      closeDialog();
    }
  }, [state, props.mode, closeDialog]);

  const errors = state.fieldErrors;

  return (
    <form ref={formRef} action={action} className={`flex flex-col gap-5 ${inDialog ? "" : "p-4"}`}>
      {edit && <input type="hidden" name="id" value={edit.id} />}

      <section aria-labelledby="when-title" className="flex flex-col gap-3">
        <h3 id="when-title" className="section-title">
          Horaire
        </h3>
        {props.mode === "create" ? (
          <>
            <input type="hidden" name="date" value={props.day} />
            <p className="card flex min-h-control items-center gap-3 px-4 text-sm font-medium">
              <CalendarIcon className="h-5 w-5 shrink-0 text-accent" />
              <span className="block first-letter:uppercase">{formatDayKeyLong(props.day)}</span>
            </p>
          </>
        ) : (
          <label className="field-label">
            Date
            <input
              type="date"
              name="date"
              required
              defaultValue={edit?.date}
              className={inputClass}
            />
            {errors?.date && <span className="field-error">{errors.date}</span>}
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">
            Début
            <input
              type="time"
              name="time"
              required
              defaultValue={edit?.time}
              className={inputClass}
            />
            {errors?.time && <span className="field-error">{errors.time}</span>}
          </label>
          <label className="field-label">
            <span>
              Fin <span className="font-normal text-faint">(facultatif)</span>
            </span>
            <input
              type="time"
              name="end_time"
              defaultValue={edit?.endTime}
              className={inputClass}
            />
            {errors?.endTime && <span className="field-error">{errors.endTime}</span>}
          </label>
        </div>
      </section>

      <section aria-labelledby="details-title" className="flex flex-col gap-3">
        <h3 id="details-title" className="section-title">
          Détails
        </h3>
        <label className="field-label">
          Titre
          <input
            name="title"
            required
            maxLength={TITLE_MAX}
            defaultValue={edit?.title}
            placeholder="Ex. Rassemblement"
            aria-invalid={errors?.title ? true : undefined}
            className={inputClass}
          />
          {errors?.title && <span className="field-error">{errors.title}</span>}
        </label>

        <label className="field-label">
          Texte
          <textarea
            name="description"
            rows={4}
            maxLength={DESCRIPTION_MAX}
            defaultValue={edit?.description}
            placeholder="Informations utiles pour les participants"
            className={inputClass}
          />
          {errors?.description && <span className="field-error">{errors.description}</span>}
        </label>

        <label className="field-label">
          <span>
            Lieu <span className="font-normal text-faint">(facultatif)</span>
          </span>
          <input
            name="location"
            maxLength={LOCATION_MAX}
            defaultValue={edit?.location}
            placeholder="Ex. Salle B"
            className={inputClass}
          />
          {errors?.location && <span className="field-error">{errors.location}</span>}
        </label>
      </section>

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
          {pending
            ? "Enregistrement…"
            : props.mode === "create"
              ? "Créer l'événement"
              : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
