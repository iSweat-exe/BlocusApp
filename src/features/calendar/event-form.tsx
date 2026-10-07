"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEvent, updateEvent, type EventFormState } from "./actions";
import { DESCRIPTION_MAX, LOCATION_MAX, TITLE_MAX } from "./schema";
import { formatDayKeyLong } from "./time";

const INITIAL_STATE: EventFormState = { status: "idle" };
const inputClass = "rounded border border-foreground/20 bg-background px-3 py-2 text-base";

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

  useEffect(() => {
    if (state.status === "success" && props.mode === "create") formRef.current?.reset();
  }, [state, props.mode]);

  const errors = state.fieldErrors;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 p-3">
      {edit && <input type="hidden" name="id" value={edit.id} />}

      {props.mode === "create" ? (
        <>
          <input type="hidden" name="date" value={props.day} />
          <p className="text-sm capitalize text-foreground/60">{formatDayKeyLong(props.day)}</p>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            name="date"
            required
            defaultValue={edit?.date}
            className={inputClass}
          />
          {errors?.date && <span className="text-red-500">{errors.date}</span>}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Heure
          <input
            type="time"
            name="time"
            required
            defaultValue={edit?.time}
            className={inputClass}
          />
          {errors?.time && <span className="text-red-500">{errors.time}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fin (facultatif)
          <input type="time" name="end_time" defaultValue={edit?.endTime} className={inputClass} />
          {errors?.endTime && <span className="text-red-500">{errors.endTime}</span>}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Titre
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={edit?.title}
          aria-invalid={errors?.title ? true : undefined}
          className={inputClass}
        />
        {errors?.title && <span className="text-red-500">{errors.title}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Texte
        <textarea
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          defaultValue={edit?.description}
          className={inputClass}
        />
        {errors?.description && <span className="text-red-500">{errors.description}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Lieu (facultatif)
        <input
          name="location"
          maxLength={LOCATION_MAX}
          defaultValue={edit?.location}
          className={inputClass}
        />
        {errors?.location && <span className="text-red-500">{errors.location}</span>}
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
        {pending
          ? "Enregistrement…"
          : props.mode === "create"
            ? "Créer l'événement"
            : "Enregistrer"}
      </button>
    </form>
  );
}
