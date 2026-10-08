"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { requirePermission } from "@/server/require-permission";

/** State returned to the permission forms. */
export type PermissionState = { status: "idle" | "success" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_KEY = /^[a-z][a-z_]{1,31}$/;
const PERMISSION_KEY = /^[a-z][a-z_]*\.[a-z][a-z_.]*$/;

/** User-facing messages for the errors raised by the permission RPCs. */
const DATABASE_ERRORS: Record<string, string> = {
  forbidden: "Tu n'as pas le droit de gérer les permissions.",
  hierarchy_violation:
    "Ce rôle ou cet utilisateur est au-dessus ou au niveau du tien : action refusée.",
  privilege_escalation: "Tu ne peux accorder qu'une permission que tu possèdes toi-même.",
  unknown_role: "Ce rôle n'existe pas.",
  unknown_permission: "Cette permission n'existe pas.",
  unknown_user: "Cet utilisateur n'existe pas.",
  invalid_effect: "Action invalide.",
};

async function guard(): Promise<PermissionState | null> {
  const permission = await requirePermission("permission.manage", { fresh: true });
  if (permission.ok) return null;
  return {
    status: "error",
    message:
      permission.error === "unauthenticated"
        ? "Connecte-toi pour continuer."
        : DATABASE_ERRORS.forbidden,
  };
}

/** Grants or revokes one permission for a whole role (`granted` = the wanted new state). */
export async function toggleRolePermission(
  _previous: PermissionState,
  formData: FormData,
): Promise<PermissionState> {
  const denied = await guard();
  if (denied) return denied;

  const role = formData.get("role");
  const permission = formData.get("permission");
  const granted = formData.get("granted");
  if (
    typeof role !== "string" ||
    !ROLE_KEY.test(role) ||
    typeof permission !== "string" ||
    !PERMISSION_KEY.test(permission) ||
    (granted !== "true" && granted !== "false")
  ) {
    return { status: "error", message: "Demande invalide." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("set_role_permission", {
    p_role: role,
    p_permission: permission,
    p_granted: granted === "true",
  });
  if (error) {
    const known = DATABASE_ERRORS[error.message];
    if (!known) logActionError("toggleRolePermission", error);
    return { status: "error", message: known ?? "La modification a échoué. Réessaie." };
  }

  revalidatePath("/admin/roles");
  return { status: "success", message: "Enregistré." };
}

/** Sets (`grant` / `deny`) or clears (`clear`) a per-user permission override. */
export async function setUserPermission(
  _previous: PermissionState,
  formData: FormData,
): Promise<PermissionState> {
  const denied = await guard();
  if (denied) return denied;

  const target = formData.get("target");
  const permission = formData.get("permission");
  const effect = formData.get("effect");
  if (
    typeof target !== "string" ||
    !UUID.test(target) ||
    typeof permission !== "string" ||
    !PERMISSION_KEY.test(permission) ||
    (effect !== "grant" && effect !== "deny" && effect !== "clear")
  ) {
    return { status: "error", message: "Demande invalide." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("set_user_permission", {
    p_target: target,
    p_permission: permission,
    // The generated type is `string`, but the SQL function takes NULL to clear an override.
    p_effect: (effect === "clear" ? null : effect) as string,
  });
  if (error) {
    const known = DATABASE_ERRORS[error.message];
    if (!known) logActionError("setUserPermission", error);
    return { status: "error", message: known ?? "La modification a échoué. Réessaie." };
  }

  revalidatePath(`/admin/users/${target}`);
  return { status: "success", message: "Enregistré." };
}
