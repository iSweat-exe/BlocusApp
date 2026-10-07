"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/require-permission";
import { type EventFieldErrors, parseEventInput } from "./schema";

/** State returned to the event form. */
export type EventFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: EventFieldErrors;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readForm(formData: FormData) {
  return parseEventInput(
    {
      title: formData.get("title"),
      description: formData.get("description"),
      location: formData.get("location"),
      date: formData.get("date"),
      time: formData.get("time"),
      endTime: formData.get("end_time"),
    },
    new Date(),
    // Creation refuses the past; editing may only change the text of an event that already started
    // (the `check_event_start` trigger still refuses moving it into the past).
    formData.get("id") === null,
  );
}

function databaseMessage(message: string): string {
  return message === "event_in_the_past"
    ? "L'événement ne peut pas commencer dans le passé."
    : "L'enregistrement a échoué. Réessaie.";
}

/** Creates an event. Requires `event.create` (checked in the database); the author is the caller. */
export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const permission = await requirePermission("event.create", { fresh: true });
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour continuer."
          : "Tu n'as pas le droit de créer des événements.",
    };
  }

  const parsed = readForm(formData);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("events").insert({
    title: parsed.value.title,
    description: parsed.value.description,
    location: parsed.value.location,
    starts_at: parsed.value.startsAt.toISOString(),
    ends_at: parsed.value.endsAt?.toISOString() ?? null,
    author_id: permission.value.userId,
  });
  if (error) return { status: "error", message: databaseMessage(error.message) };

  revalidatePath("/calendar");
  revalidatePath("/");
  return { status: "success", message: "Événement créé." };
}

/** Edits an event. Requires `event.create`; Row Level Security limits it to the caller's own events. */
export async function updateEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) {
    return { status: "error", message: "Demande invalide." };
  }

  const permission = await requirePermission("event.create", { fresh: true });
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour continuer."
          : "Tu n'as pas le droit de modifier des événements.",
    };
  }

  const parsed = readForm(formData);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("events")
    .update({
      title: parsed.value.title,
      description: parsed.value.description,
      location: parsed.value.location,
      starts_at: parsed.value.startsAt.toISOString(),
      ends_at: parsed.value.endsAt?.toISOString() ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { status: "error", message: databaseMessage(error.message) };
  // RLS hides other people's events: nothing matched.
  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "Impossible de modifier : ce n'est pas ton événement, ou il est terminé.",
    };
  }

  revalidatePath(`/calendar/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  return { status: "success", message: "Événement modifié." };
}

/**
 * Deletes an event: any event with `event.delete`, otherwise only the caller's own with `event.create`.
 * Row Level Security enforces the same rule in the database.
 */
export async function deleteEvent(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;

  const supabase = createClient(await cookies());
  const canDeleteAny = await requirePermission("event.delete", { fresh: true });
  if (canDeleteAny.ok) {
    await supabase.from("events").delete().eq("id", id);
  } else {
    const canCreate = await requirePermission("event.create", { fresh: true });
    if (!canCreate.ok) return;
    await supabase.from("events").delete().eq("id", id).eq("author_id", canCreate.value.userId);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/calendar");
}

/**
 * Marks an event as finished (`finished=true`) or reopens it. Requires `event.finish`, checked against the
 * database; `set_event_finished()` re-checks it and journals the change.
 */
export async function setEventFinished(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const id = formData.get("id");
  const finished = formData.get("finished");
  if (typeof id !== "string" || !UUID.test(id) || (finished !== "true" && finished !== "false")) {
    return { status: "error", message: "Demande invalide." };
  }

  const permission = await requirePermission("event.finish", { fresh: true });
  if (!permission.ok) {
    return {
      status: "error",
      message:
        permission.error === "unauthenticated"
          ? "Connecte-toi pour continuer."
          : "Tu n'as pas le droit de terminer des événements.",
    };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("set_event_finished", {
    p_id: id,
    p_finished: finished === "true",
  });
  if (error) {
    return {
      status: "error",
      message:
        error.message === "unknown_event"
          ? "Cet événement n'existe plus."
          : "La modification a échoué. Réessaie.",
    };
  }

  revalidatePath(`/calendar/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    status: "success",
    message: finished === "true" ? "Événement terminé." : "Événement rouvert.",
  };
}
