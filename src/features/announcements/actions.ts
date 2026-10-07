"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/require-permission";
import { type AnnouncementFieldErrors, validateAnnouncementInput } from "./schema";

/** State returned to the publish form. */
export type PublishState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: AnnouncementFieldErrors;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Publishes an announcement. Requires `announcement.publish`; the author is always the caller. */
export async function publishAnnouncement(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const permission = await requirePermission("announcement.publish");
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour publier."
          : "Tu n'as pas le droit de publier des annonces.",
    };
  }

  const parsed = validateAnnouncementInput({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("announcements")
    .insert({ ...parsed.value, author_id: permission.value.userId });
  if (error) return { status: "error", message: "La publication a échoué. Réessaie." };

  updateTag("announcements");
  revalidatePath("/");
  return { status: "success", message: "Annonce publiée." };
}

/**
 * Deletes an announcement: any announcement with `announcement.delete`, otherwise only the caller's
 * own with `announcement.publish`. Row Level Security enforces the same rule in the database.
 */
export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;

  const supabase = createClient(await cookies());
  const canDeleteAny = await requirePermission("announcement.delete");
  if (canDeleteAny.ok) {
    await supabase.from("announcements").delete().eq("id", id);
  } else {
    const canPublish = await requirePermission("announcement.publish");
    if (!canPublish.ok) return;
    await supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("author_id", canPublish.value.userId);
  }

  updateTag("announcements");
  revalidatePath("/");
}
