"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Select } from "@/components/select";
import { banUser, type BanState } from "./sanction-actions";
import { DURATION_LABELS, DURATION_PRESETS, type DurationPreset, REASON_MAX } from "./sanctions";

const INITIAL_STATE: BanState = { status: "idle" };

/** Ban form: reason plus a duration preset or a custom expiry (the server re-validates everything). */
export function BanForm({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState(banUser, INITIAL_STATE);
  const [duration, setDuration] = useState<DurationPreset>("24h");
  const [localDate, setLocalDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  // datetime-local has no time zone: convert with the browser's zone to an absolute ISO instant.
  const customIso = localDate ? new Date(localDate).toISOString() : "";

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4"
    >
      <h3 className="font-semibold">Bannir</h3>
      <input type="hidden" name="target" value={targetId} />

      <label className="flex flex-col gap-1 text-sm">
        Motif
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
          className="rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base"
        />
        {state.fieldErrors?.reason && (
          <span className="text-red-500">{state.fieldErrors.reason}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Durée
        <Select
          name="duration"
          label="Durée"
          value={duration}
          onChange={(next) => setDuration(next as DurationPreset)}
          options={DURATION_PRESETS.map((preset) => ({
            value: preset,
            label: DURATION_LABELS[preset],
          }))}
        />
      </label>

      {duration === "custom" && (
        <label className="flex flex-col gap-1 text-sm">
          Expire le
          <input
            type="datetime-local"
            value={localDate}
            onChange={(event) => setLocalDate(event.target.value)}
            required
            className="min-h-12 rounded-xl border border-foreground/15 bg-background px-4 text-base"
          />
          <input type="hidden" name="custom_expires_at" value={customIso} />
        </label>
      )}
      {state.fieldErrors?.duration && (
        <p className="text-sm text-red-500">{state.fieldErrors.duration}</p>
      )}

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
        className="min-h-12 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white active:bg-red-600 disabled:opacity-60"
      >
        {pending ? "Bannissement…" : "Bannir"}
      </button>
    </form>
  );
}
