import { connection } from "next/server";
import { Suspense } from "react";
import { MapLoader, MapSkeleton } from "@/features/map/map-loader";
import { getCurrentRoute } from "@/lib/data/map";
import { getMapPositions } from "@/lib/data/map-positions";
import { getSessionPermissions } from "@/server/session";

async function MapContent() {
  // The shared cache holds data that does not depend on the request: read it at request time, not at build time.
  await connection();
  const [route, positions, session] = await Promise.all([
    getCurrentRoute(),
    getMapPositions(),
    getSessionPermissions(),
  ]);
  const current = route.ok ? route.value : null;
  const stored = positions.ok ? positions.value : [];
  const newest = stored[0];
  const permissions = session?.permissions ?? [];
  // The person who declared the current position may remove it, and so may holders of `map.position.remove`.
  // Computed here (the cached list is shared by everybody), and the author id never reaches the browser.
  const canRemovePosition =
    !!newest &&
    !newest.removedAt &&
    ((newest.authorId !== null &&
      newest.authorId === session?.userId &&
      permissions.includes("map.position.declare")) ||
      permissions.includes("map.position.remove"));

  return (
    <MapLoader
      route={current ? { id: current.id, points: current.points } : null}
      // Display only: the Server Action and the database re-check the permission.
      canEditRoute={session?.permissions.includes("map.route.edit") ?? false}
      // An explicit allowlist: the author id must never reach the browser.
      positions={stored.map((position) => ({
        id: position.id,
        lng: position.lng,
        lat: position.lat,
        label: position.label,
        declaredAt: position.declaredAt,
        removedAt: position.removedAt,
      }))}
      canDeclarePosition={permissions.includes("map.position.declare")}
      canRemovePosition={canRemovePosition}
    />
  );
}

export default function MapPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Carte</h1>
      </div>
      <Suspense fallback={<MapSkeleton />}>
        <MapContent />
      </Suspense>
    </div>
  );
}
