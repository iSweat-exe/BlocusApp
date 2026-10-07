"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/require-permission";
import { type BanFieldErrors, parseBanInput } from "./sanctions";

/** State returned to the ban form. */
export type BanState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: BanFieldErrors;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** User-facing messages for the errors raised by `ban_user()` and `revoke_sanction()`. */
const DATABASE_ERRORS: Record<string, string> = {
  forbidden: "Tu n'as pas le droit de sanctionner.",
  hierarchy_violation: "Cet utilisateur a un rôle supérieur ou égal au tien : action refusée.",
  invalid_reason: "Le motif est invalide.",
  invalid_expiry: "La date d'expiration doit être dans le futur.",
  unknown_user: "Cet utilisateur n'existe pas.",
  already_banned: "Cet utilisateur est déjà banni.",
  unknown_sanction: "Cette sanction n'existe pas.",
  not_active: "Cette sanction n'est plus active.",
};

/** Bans a user. Requires `user.ban`, checked against the database; the hierarchy is enforced there too. */
export async function banUser(_previous: BanState, formData: FormData): Promise<BanState> {
  const permission = await requirePermission("user.ban", { fresh: true });
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
  if (typeof target !== "string" || !UUID.test(target)) {
    return { status: "error", message: "Demande invalide." };
  }

  const parsed = parseBanInput(
    {
      reason: formData.get("reason"),
      duration: formData.get("duration"),
      customExpiresAt: formData.get("custom_expires_at"),
    },
    new Date(),
  );
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("ban_user", {
    p_target: target,
    p_reason: parsed.value.reason,
    p_expires_at: parsed.value.expiresAt?.toISOString(),
  });
  if (error) {
    return {
      status: "error",
      message: DATABASE_ERRORS[error.message] ?? "Le bannissement a échoué. Réessaie.",
    };
  }

  revalidatePath(`/admin/users/${target}`);
  return { status: "success", message: "Utilisateur banni." };
}

/** Lifts an active ban early. Requires `user.ban`; hierarchy enforced by `revoke_sanction()`. */
export async function liftSanction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const target = formData.get("target");
  if (
    typeof id !== "string" ||
    !UUID.test(id) ||
    typeof target !== "string" ||
    !UUID.test(target)
  ) {
    return;
  }

  const permission = await requirePermission("user.ban", { fresh: true });
  if (!permission.ok) return;

  const supabase = createClient(await cookies());
  await supabase.rpc("revoke_sanction", { p_id: id });
  revalidatePath(`/admin/users/${target}`);
}
