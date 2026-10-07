"use client";

import { useActionState } from "react";
import { changeRole, type ChangeRoleState } from "./actions";
import { Select } from "@/components/select";
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
    <form action={action} className="flex w-full flex-col gap-1">
      <input type="hidden" name="target" value={targetId} />
      <div className="flex items-center gap-2">
        <Select
          name="role"
          label="Rôle"
          size="sm"
          defaultValue={currentRole}
          options={options.map((role) => ({ value: role.key, label: role.label }))}
          className="min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white active:bg-red-600 disabled:opacity-60"
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
