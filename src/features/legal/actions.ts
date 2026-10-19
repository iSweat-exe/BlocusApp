"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { getSessionPermissions } from "@/server/session";
import {
  ANNOUNCEMENT_IMAGES_BUCKET,
  DELETE_CONFIRMATION,
  isDeleteConfirmed,
  removeUserImages,
} from "./my-data";

/** State returned to the deletion form (a success never returns: the person is sent to the login). */
export type DeleteAccountState = { status: "idle" | "error"; message?: string };

const FAILED = "La suppression a échoué. Réessaie, ou écris-nous si cela continue.";

/**
 * Deletes the account of the signed-in user, for good (GDPR right to erasure). In order: the confirmation word is
 * checked, the photos of the account are removed from Storage, then the Auth user is deleted (the profile and
 * everything that hangs on it follow by `on delete cascade`; posts, events and positions stay, no longer linked to
 * anybody). Last, the session cookies are cleared and the person lands on the login.
 *
 * A super administrator cannot delete their account: the last one would leave the application without anybody who
 * can manage roles. The role has to be handed over first.
 * The service role is needed because deleting an Auth user is an admin API; the user id comes from the session,
 * never from the form.
 */
export async function deleteMyAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (!isDeleteConfirmed(formData.get("confirmation"))) {
    return { status: "error", message: `Écris ${DELETE_CONFIRMATION} pour confirmer.` };
  }

  const session = await getSessionPermissions();
  if (!session) return { status: "error", message: "Connecte-toi pour continuer." };
  if (session.role === "super_admin") {
    return {
      status: "error",
      message:
        "Un super administrateur ne peut pas supprimer son compte : transmets d'abord ce rôle.",
    };
  }

  try {
    const service = createServiceClient();
    await removeUserImages(service.storage.from(ANNOUNCEMENT_IMAGES_BUCKET), session.userId);
    const { error } = await service.auth.admin.deleteUser(session.userId);
    if (error) throw new Error(error.code ?? error.name);
  } catch (cause) {
    // Reason only: no id, no e-mail.
    console.error("[deleteMyAccount] failed:", cause instanceof Error ? cause.message : "unknown");
    return { status: "error", message: FAILED };
  }

  try {
    await createClient(await requestCookies()).auth.signOut({ scope: "local" });
  } catch {
    // The account is gone, so the session is useless anyway; the cookies expire by themselves.
  }
  redirect("/login?deleted=1");
}
