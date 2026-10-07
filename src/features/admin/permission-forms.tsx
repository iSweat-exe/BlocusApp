"use client";

import { useActionState } from "react";
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
      className={state.status === "error" ? "text-xs text-red-500" : "text-xs text-green-600"}
    >
      {state.message}
    </p>
  );
}

/** One role x permission toggle. `granted` is the *wanted* state, i.e. the opposite of the current one. */
export function RolePermissionToggle({
  role,
  permission,
  currentlyGranted,
}: {
  role: string;
  permission: string;
  currentlyGranted: boolean;
}) {
  const [state, action, pending] = useActionState(toggleRolePermission, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="permission" value={permission} />
      <input type="hidden" name="granted" value={currentlyGranted ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-foreground/20 px-3 py-1 text-sm disabled:opacity-60"
      >
        {pending ? "…" : currentlyGranted ? "Retirer" : "Accorder"}
      </button>
      <Feedback state={state} />
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
  const buttonClass = "rounded border border-foreground/20 px-2 py-1 text-xs disabled:opacity-60";
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="permission" value={permission} />
      <div className="flex gap-1">
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
