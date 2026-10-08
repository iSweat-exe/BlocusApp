"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { requirePermission } from "@/server/require-permission";
import { detectImageType, IMAGE_MAX_BYTES, IMAGE_MAX_DIMENSION, type ImageType } from "./image";
import { type AnnouncementFieldErrors, type PostStatus, validateAnnouncementInput } from "./schema";

/** State returned to the publish and edit forms. */
export type PublishState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: AnnouncementFieldErrors;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "announcement-images";
const CONTENT_TYPES: Record<ImageType, string> = { webp: "image/webp", jpg: "image/jpeg" };

type Supabase = ReturnType<typeof createClient>;

/** An image of the form, checked and ready to upload. */
type PendingImage = { bytes: Uint8Array; type: ImageType; width: number; height: number };

/**
 * Reads the optional `image` of a form. The browser compresses it first, but nothing it says is trusted: the
 * size, the real format (from the first bytes) and the dimensions are checked here, and the bucket enforces
 * the same limits again.
 */
async function readImage(
  formData: FormData,
): Promise<{ ok: true; value: PendingImage | null } | { ok: false; message: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: true, value: null };
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: "L'image est trop lourde (300 Ko maximum après compression)." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, message: "Format d'image non pris en charge (WebP ou JPEG)." };

  const width = Number(formData.get("image_width"));
  const height = Number(formData.get("image_height"));
  const valid = (size: number) =>
    Number.isInteger(size) && size >= 1 && size <= IMAGE_MAX_DIMENSION;
  if (!valid(width) || !valid(height))
    return { ok: false, message: "Dimensions d'image invalides." };

  return { ok: true, value: { bytes, type, width, height } };
}

/** Uploads an image into the caller's folder under a random name. @returns Its path, or `null` on failure. */
async function uploadImage(
  supabase: Supabase,
  userId: string,
  image: PendingImage,
): Promise<string | null> {
  const path = `${userId}/${crypto.randomUUID()}.${image.type}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, image.bytes, {
    contentType: CONTENT_TYPES[image.type],
    // The name is unique and never reused: browsers and the CDN may keep the file for a year.
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    logActionError("uploadImage", error);
    return null;
  }
  return path;
}

/** Removes an image file. A failure only leaves an orphan file, so it is logged, never shown. */
async function removeImage(supabase: Supabase, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) logActionError("removeImage", error);
}

/** What the user is told once a post is saved, by visibility. */
const SAVED_MESSAGES: Record<PostStatus, { created: string; updated: string }> = {
  draft: { created: "Brouillon enregistré.", updated: "Brouillon mis à jour." },
  private: { created: "Post privé enregistré.", updated: "Post privé mis à jour." },
  public: { created: "Annonce publiée.", updated: "Annonce modifiée." },
};

/**
 * Creates a post (draft, private or public), with an optional image. Requires `announcement.publish`; the author
 * is always the caller.
 */
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
    status: formData.get("status"),
    showAuthor: formData.get("show_author"),
  });
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const image = await readImage(formData);
  if (!image.ok) return { status: "error", fieldErrors: { image: image.message } };

  const supabase = createClient(await cookies());
  const userId = permission.value.userId;

  let imagePath: string | null = null;
  if (image.value) {
    imagePath = await uploadImage(supabase, userId, image.value);
    if (!imagePath) return { status: "error", message: "L'envoi de l'image a échoué. Réessaie." };
  }

  const { error } = await supabase.from("announcements").insert({
    ...parsed.value,
    author_id: userId,
    image_path: imagePath,
    image_width: image.value?.width ?? null,
    image_height: image.value?.height ?? null,
  });
  if (error) {
    await removeImage(supabase, imagePath);
    return { status: "error", message: "La publication a échoué. Réessaie." };
  }

  updateTag("announcements");
  return { status: "success", message: SAVED_MESSAGES[parsed.value.status].created };
}

/**
 * Edits a post of the caller: text, visibility, "show author" and image (replaced by a new file, or removed with
 * `remove_image=1`). Requires `announcement.publish`; only the author can edit, in the database too.
 */
export async function updateAnnouncement(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const permission = await requirePermission("announcement.publish");
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour modifier."
          : "Tu n'as pas le droit de modifier des annonces.",
    };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id))
    return { status: "error", message: "Demande invalide." };

  const parsed = validateAnnouncementInput({
    title: formData.get("title"),
    body: formData.get("body"),
    status: formData.get("status"),
    showAuthor: formData.get("show_author"),
  });
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const image = await readImage(formData);
  if (!image.ok) return { status: "error", fieldErrors: { image: image.message } };

  const supabase = createClient(await cookies());
  const userId = permission.value.userId;

  const { data: current } = await supabase
    .from("announcements")
    .select("image_path")
    .eq("id", id)
    .eq("author_id", userId)
    .maybeSingle();
  if (!current) return { status: "error", message: "Ce post n'existe plus." };

  let newPath: string | null = null;
  if (image.value) {
    newPath = await uploadImage(supabase, userId, image.value);
    if (!newPath) return { status: "error", message: "L'envoi de l'image a échoué. Réessaie." };
  }
  const removeCurrent = formData.get("remove_image") === "1";

  const values = {
    ...parsed.value,
    // Untouched unless a new image replaces it or it is removed.
    ...(image.value
      ? { image_path: newPath, image_width: image.value.width, image_height: image.value.height }
      : removeCurrent
        ? { image_path: null, image_width: null, image_height: null }
        : {}),
  };
  const { data, error } = await supabase
    .from("announcements")
    .update(values)
    .eq("id", id)
    .eq("author_id", userId)
    .select("id");
  if (error || !data || data.length === 0) {
    await removeImage(supabase, newPath);
    return { status: "error", message: "La modification a échoué. Réessaie." };
  }

  if (newPath || removeCurrent) await removeImage(supabase, current.image_path);

  updateTag("announcements");
  return { status: "success", message: SAVED_MESSAGES[parsed.value.status].updated };
}

/**
 * Deletes an announcement: any announcement with `announcement.delete`, otherwise only the caller's
 * own with `announcement.publish`. Row Level Security enforces the same rule in the database. Its image file
 * is removed with it.
 */
export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;

  const supabase = createClient(await cookies());
  const canDeleteAny = await requirePermission("announcement.delete");
  // `null` = any post (moderator); otherwise the caller's own posts only.
  let ownerId: string | null = null;
  if (!canDeleteAny.ok) {
    const canPublish = await requirePermission("announcement.publish");
    if (!canPublish.ok) return;
    ownerId = canPublish.value.userId;
  }

  // Read first (the image path), through Row Level Security: only the author or a moderator sees the row.
  let lookup = supabase.from("announcements").select("image_path").eq("id", id);
  if (ownerId) lookup = lookup.eq("author_id", ownerId);
  const { data: current } = await lookup.maybeSingle();

  let remove = supabase.from("announcements").delete().eq("id", id);
  if (ownerId) remove = remove.eq("author_id", ownerId);
  const { error } = await remove;
  if (error) {
    logActionError("deleteAnnouncement", error);
    return;
  }

  await removeImage(supabase, current?.image_path);
  updateTag("announcements");
}
