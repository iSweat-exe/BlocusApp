"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useDialogClose, useInDialog } from "@/components/full-screen-dialog";
import { Select } from "@/components/select";
import type { MyAnnouncement } from "@/lib/data/announcements";
import { publishAnnouncement, updateAnnouncement, type PublishState } from "./actions";
import { compressImage, type CompressedImage } from "./compress-image";
import { announcementImageUrl } from "./image";
import { BODY_MAX, POST_STATUS_LABELS, POST_STATUSES, type PostStatus, TITLE_MAX } from "./schema";

const INITIAL_STATE: PublishState = { status: "idle" };

const STATUS_OPTIONS = POST_STATUSES.map((value) => ({ value, label: POST_STATUS_LABELS[value] }));

const STATUS_HINTS: Record<PostStatus, string> = {
  draft: "Visible par toi seul, pour finir plus tard.",
  private: "Visible par toi seul, jamais publié.",
  public: "Visible par tout le monde, invités compris.",
};

const SUBMIT_LABELS: Record<PostStatus, [string, string]> = {
  draft: ["Enregistrer le brouillon", "Enregistrement…"],
  private: ["Enregistrer en privé", "Enregistrement…"],
  public: ["Publier", "Publication…"],
};

const IMAGE_ERRORS: Record<string, string> = {
  image_unreadable: "Cette image ne peut pas être lue. Essaie une autre photo.",
  image_too_large: "Cette image reste trop lourde même compressée. Essaie une autre photo.",
};

const formatKo = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} Ko`;

/**
 * Create / edit form of a post, only rendered for users holding `announcement.publish` (the server re-checks).
 * With `post` it edits that post, otherwise it creates one. A chosen photo is compressed in the browser (1600 px
 * at most, WebP or JPEG, about 220 KB) before anything is sent, so the free storage quota stays safe.
 */
export function AnnouncementForm({ post }: { post?: MyAnnouncement }) {
  const editing = post !== undefined;
  const [state, action, pending] = useActionState(
    editing ? updateAnnouncement : publishAnnouncement,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const closeDialog = useDialogClose();
  const inDialog = useInDialog();

  const [status, setStatus] = useState<PostStatus>((post?.status as PostStatus) ?? "public");
  const [image, setImage] = useState<(CompressedImage & { previewUrl: string }) | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Free the preview when it is replaced or the form goes away.
  useEffect(() => () => (image ? URL.revokeObjectURL(image.previewUrl) : undefined), [image]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      closeDialog();
    }
  }, [state, closeDialog]);

  const pickImage = async (file: File | undefined) => {
    setImageError(null);
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setImage({ ...compressed, previewUrl: URL.createObjectURL(compressed.blob) });
      setRemoveImage(false);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setImageError(IMAGE_ERRORS[code] ?? IMAGE_ERRORS.image_unreadable!);
    } finally {
      setCompressing(false);
    }
  };

  // The form posts the compressed image, never the original file the user picked.
  const submit = (formData: FormData) => {
    if (image) {
      formData.set(
        "image",
        new File([image.blob], `image.${image.type}`, { type: image.blob.type }),
      );
      formData.set("image_width", String(image.width));
      formData.set("image_height", String(image.height));
    }
    if (removeImage && !image) formData.set("remove_image", "1");
    action(formData);
  };

  const currentImagePath = !removeImage && !image ? post?.image_path : null;
  const [submitLabel, pendingLabel] = SUBMIT_LABELS[status];
  const fieldErrors = state.fieldErrors;

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-5">
      {editing && <input type="hidden" name="id" value={post.id} />}

      <label className="field-label">
        Titre
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={post?.title}
          placeholder="Ex. Rendez-vous place de la République"
          aria-invalid={fieldErrors?.title ? true : undefined}
          className="field"
        />
        {fieldErrors?.title && <span className="field-error">{fieldErrors.title}</span>}
      </label>

      <label className="field-label">
        Message
        <textarea
          name="body"
          required
          rows={8}
          maxLength={BODY_MAX}
          defaultValue={post?.body}
          placeholder="Écris ton message…"
          aria-invalid={fieldErrors?.body ? true : undefined}
          className="field"
        />
        {fieldErrors?.body && <span className="field-error">{fieldErrors.body}</span>}
      </label>

      <div className="flex flex-col gap-2">
        <span className="field-label">Photo (facultative)</span>
        {(image || currentImagePath) && (
          <Image
            src={image ? image.previewUrl : announcementImageUrl(currentImagePath!)}
            alt="Aperçu de la photo du post"
            width={image?.width ?? post?.image_width ?? 800}
            height={image?.height ?? post?.image_height ?? 600}
            unoptimized
            className="h-auto max-h-56 w-full rounded-control border border-line object-cover"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-outline btn-sm cursor-pointer">
            {image || currentImagePath ? "Changer la photo" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={compressing || pending}
              onChange={(event) => {
                void pickImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {(image || currentImagePath) && (
            <button
              type="button"
              className="btn btn-sm font-medium active:bg-foreground/10"
              onClick={() => {
                setImage(null);
                setRemoveImage(true);
              }}
            >
              Retirer
            </button>
          )}
          {compressing && <span className="text-sm text-muted">Compression…</span>}
          {image && !compressing && (
            <span className="text-sm text-muted">Prête : {formatKo(image.blob.size)}</span>
          )}
        </div>
        {(imageError || fieldErrors?.image) && (
          <span role="alert" className="field-error">
            {imageError ?? fieldErrors?.image}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="field-label">Visibilité</span>
        <Select
          name="status"
          label="Visibilité"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setStatus(value as PostStatus)}
        />
        <span className="text-xs text-muted">{STATUS_HINTS[status]}</span>
        {fieldErrors?.status && <span className="field-error">{fieldErrors.status}</span>}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="show_author"
          defaultChecked={post?.show_author}
          className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
        />
        <span>
          Afficher l&apos;auteur
          <span className="block text-xs text-muted">
            Montre ton pseudo et ta photo de profil publiquement sur ce post.
          </span>
        </span>
      </label>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-feedback-error" : "text-feedback-success"}
        >
          {state.message}
        </p>
      )}

      <div className={inDialog ? "form-actions" : undefined}>
        <button type="submit" disabled={pending || compressing} className="btn btn-primary w-full">
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
