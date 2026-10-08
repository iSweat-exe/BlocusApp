"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { requirePermission } from "@/server/require-permission";

/** State returned to the role form. */
export type ChangeRoleState = { status: "idle" | "success" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_KEY = /^[a-z][a-z_]{1,31}$/;

/** User-facing messages for the errors raised by `assign_role()`. */
const DATABASE_ERRORS: Record<string, string> = {
  forbidden: "Tu n'as pas le droit de modifier les rôles.",
  hierarchy_violation: "Ce rôle est au-dessus ou au niveau du tien : action refusée.",
  unknown_role: "Ce rôle n'existe pas.",
  unknown_user: "Cet utilisateur n'existe pas.",
};

/**
 * Changes the role of a user. Requires `role.assign`, checked against the database (`fresh`) because
 * JWT claims can be stale; the hierarchy is enforced by `assign_role()` itself.
 */
export async function changeRole(
  _previous: ChangeRoleState,
  formData: FormData,
): Promise<ChangeRoleState> {
  const permission = await requirePermission("role.assign", { fresh: true });
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour continuer."
          : DATABASE_ERRORS.forbidden,
    };
  }

  const target = formData.get("target");
  const role = formData.get("role");
  if (
    typeof target !== "string" ||
    !UUID.test(target) ||
    typeof role !== "string" ||
    !ROLE_KEY.test(role)
  ) {
    return { status: "error", message: "Demande invalide." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("assign_role", { p_target: target, p_role: role });
  if (error) {
    const known = DATABASE_ERRORS[error.message];
    if (!known) logActionError("changeRole", error);
    return { status: "error", message: known ?? "La modification a échoué. Réessaie." };
  }

  revalidatePath("/admin");
  return { status: "success", message: "Rôle modifié." };
}
