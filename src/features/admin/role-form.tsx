"use client";

import { useActionState } from "react";
import { changeRole, type ChangeRoleState } from "./actions";
import type { RoleInfo } from "./hierarchy";

const INITIAL_STATE: ChangeRoleState = { status: "idle" };

/** Role selector for one user. Only rendered when the hierarchy allows it (the server re-checks). */
export function RoleForm({
  targetId,
  currentRole,
  options,
}: {
  targetId: string;
  currentRole: string;
  options: RoleInfo[];
}) {
  const [state, action, pending] = useActionState(changeRole, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="target" value={targetId} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          defaultValue={currentRole}
          aria-label="Rôle"
          className="rounded border border-foreground/20 bg-background px-2 py-1 text-sm"
        >
          {options.map((role) => (
            <option key={role.key} value={role.key}>
              {role.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-500 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "…" : "Appliquer"}
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-xs text-red-500" : "text-xs text-green-600"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
