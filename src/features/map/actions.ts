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
