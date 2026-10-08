"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { parseRoutePoints } from "@/lib/map-route";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/require-permission";

/** Result of saving the route. `stale` = somebody else saved in the meantime. */
export type SaveRouteState =
  | { status: "success"; versionId: string }
  | {
      status: "error";
      code: "invalid" | "forbidden" | "unauthenticated" | "stale" | "failed";
      message: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saves the route as a new version. Requires `map.route.edit` (checked in the database, which also validates
 * the points). `baseVersionId` is the version the editor started from: if another version was saved since,
 * nothing is overwritten and the editor is told to reload.
 */
export async function saveMapRoute(
  points: unknown,
  baseVersionId: string | null,
): Promise<SaveRouteState> {
  const permission = await requirePermission("map.route.edit", { fresh: true });
  if (!permission.ok) {
    return permission.error === "unauthenticated"
      ? { status: "error", code: "unauthenticated", message: "Connecte-toi pour continuer." }
      : {
          status: "error",
          code: "forbidden",
          message: "Tu n'as pas le droit de modifier le tracé.",
        };
  }

  const clean = parseRoutePoints(points);
  if (!clean || (baseVersionId !== null && !UUID.test(baseVersionId))) {
    return { status: "error", code: "invalid", message: "Le tracé n'est pas valide." };
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("save_map_route", {
    p_points: clean,
    // The generated type is `string`, but the SQL function takes NULL when there was no route.
    p_base: baseVersionId as string,
  });
  if (error) {
    if (error.message === "stale_route") {
      return {
        status: "error",
        code: "stale",
        message: "Le tracé a été modifié par quelqu'un d'autre. Recharge-le avant de continuer.",
      };
    }
    return { status: "error", code: "failed", message: "L'enregistrement a échoué. Réessaie." };
  }

  updateTag("map-route");
  revalidatePath("/map");
  return { status: "success", versionId: data };
}

/** Result of declaring the position of the demonstration. */
export type DeclarePositionState =
  | { status: "success" }
  | {
      status: "error";
      code: "invalid" | "forbidden" | "unauthenticated" | "rate_limited" | "failed";
      message: string;
    };

/**
 * Declares the current position of the demonstration. Requires `map.position.declare` (checked in the
 * database, which also validates the coordinates and refuses a declaration within 5 seconds of the previous
 * one). Only this declared position is ever stored: the position of ordinary users never leaves their device.
 */
export async function declareMapPosition(
  lng: unknown,
  lat: unknown,
  label: unknown,
): Promise<DeclarePositionState> {
  const permission = await requirePermission("map.position.declare", { fresh: true });
  if (!permission.ok) {
    return permission.error === "unauthenticated"
      ? { status: "error", code: "unauthenticated", message: "Connecte-toi pour continuer." }
      : {
          status: "error",
          code: "forbidden",
          message: "Tu n'as pas le droit de déclarer la position.",
        };
  }

  const text = typeof label === "string" ? label.trim() : "";
  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90 ||
    (label !== undefined && label !== null && typeof label !== "string") ||
    text.length > 80
  ) {
    return { status: "error", code: "invalid", message: "La position n'est pas valide." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("declare_map_position", {
    p_lng: lng,
    p_lat: lat,
    p_label: text,
  });
  if (error) {
    if (error.message === "rate_limited") {
      return {
        status: "error",
        code: "rate_limited",
        message: "Patiente quelques secondes avant de déclarer une nouvelle position.",
      };
    }
    return { status: "error", code: "failed", message: "La déclaration a échoué. Réessaie." };
  }

  updateTag("map-positions");
  revalidatePath("/map");
  return { status: "success" };
}

/** Result of removing a declared position. */
export type RemovePositionState =
  | { status: "success" }
  | {
      status: "error";
      code: "invalid" | "forbidden" | "unauthenticated" | "unknown" | "failed";
      message: string;
    };

/**
 * Removes a declared position that is no longer current. Allowed to the person who declared it (still holding
 * `map.position.declare`) and to holders of `map.position.remove`: the database decides which, this action only
 * checks that somebody is signed in and may act on the map at all.
 */
export async function removeMapPosition(id: unknown): Promise<RemovePositionState> {
  const declare = await requirePermission("map.position.declare", { fresh: true });
  if (!declare.ok) {
    if (declare.error === "unauthenticated") {
      return { status: "error", code: "unauthenticated", message: "Connecte-toi pour continuer." };
    }
    const remove = await requirePermission("map.position.remove", { fresh: true });
    if (!remove.ok) {
      return {
        status: "error",
        code: "forbidden",
        message: "Tu n'as pas le droit de retirer cette position.",
      };
    }
  }

  if (typeof id !== "string" || !UUID.test(id)) {
    return { status: "error", code: "invalid", message: "Position invalide." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("remove_map_position", { p_id: id });
  if (error) {
    if (error.message === "forbidden") {
      return {
        status: "error",
        code: "forbidden",
        message:
          "Seule la personne qui a déclaré cette position (ou un administrateur) peut la retirer.",
      };
    }
    if (error.message === "unknown_position") {
      return { status: "error", code: "unknown", message: "Cette position n'existe plus." };
    }
    return { status: "error", code: "failed", message: "Le retrait a échoué. Réessaie." };
  }

  updateTag("map-positions");
  revalidatePath("/map");
  return { status: "success" };
}
