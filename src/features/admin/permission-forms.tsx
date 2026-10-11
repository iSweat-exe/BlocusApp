"use client";

import { useActionState, useOptimistic } from "react";
import {
  setUserPermission,
  toggleRolePermission,
  type PermissionState,
} from "./permission-actions";

const INITIAL_STATE: PermissionState = { status: "idle" };

function Feedback({ state }: { state: PermissionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={state.status === "error" ? "text-xs text-danger" : "text-xs text-success"}
    >
      {state.message}
    </p>
  );
}

/**
 * One role x permission switch. It flips at once (optimistic) and goes back by itself when the server refuses:
 * the page then re-renders with the stored state. The form sends the *wanted* state, the opposite of the
 * current one, so it works without any client state and the server stays authoritative.
 */
export function RolePermissionSwitch({
  role,
  permission,
  currentlyGranted,
  label,
}: {
  role: string;
  permission: string;
  currentlyGranted: boolean;
  /** Accessible name: what the switch controls, and for which role. */
  label: string;
}) {
  const [state, dispatch, pending] = useActionState(toggleRolePermission, INITIAL_STATE);
  const [granted, setGranted] = useOptimistic(currentlyGranted);

  function submit(formData: FormData) {
    setGranted(!currentlyGranted);
    dispatch(formData);
  }

  return (
    <form action={submit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="permission" value={permission} />
      <input type="hidden" name="granted" value={currentlyGranted ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={granted}
        aria-label={label}
        aria-busy={pending}
        disabled={pending}
        className="flex h-tap w-14 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className={`flex h-7 w-12 items-center rounded-full transition-colors ${
            granted ? "bg-accent" : "bg-foreground/20"
          } ${pending ? "opacity-60" : ""}`}
        >
          <span
            className={`block size-6 rounded-full bg-white shadow-sm transition-transform ${
              granted ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      {state.status === "error" && state.message && (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <span role="status" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}

/** Override controls of one user and one permission: grant, deny or go back to the role default. */
export function UserOverrideControls({
  target,
  permission,
  override,
  canGrant,
}: {
  target: string;
  permission: string;
  override: "grant" | "deny" | null;
  canGrant: boolean;
}) {
  const [state, action, pending] = useActionState(setUserPermission, INITIAL_STATE);
  const buttonClass = "btn btn-outline btn-sm !px-3 !text-xs";
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="permission" value={permission} />
      <div className="flex flex-wrap justify-end gap-1">
        {canGrant && override !== "grant" && (
          <button
            type="submit"
            name="effect"
            value="grant"
            disabled={pending}
            className={buttonClass}
          >
            Accorder
          </button>
        )}
        {override !== "deny" && (
          <button
            type="submit"
            name="effect"
            value="deny"
            disabled={pending}
            className={buttonClass}
          >
            Refuser
          </button>
        )}
        {override && (
          <button
            type="submit"
            name="effect"
            value="clear"
            disabled={pending}
            className={buttonClass}
          >
            Réinitialiser
          </button>
        )}
      </div>
      <Feedback state={state} />
    </form>
  );
}
