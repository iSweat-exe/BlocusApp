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

  return (
    <MapLoader
      route={current ? { id: current.id, points: current.points } : null}
      // Display only: the Server Action and the database re-check the permission.
      canEditRoute={session?.permissions.includes("map.route.edit") ?? false}
      positions={positions.ok ? positions.value : []}
      canDeclarePosition={session?.permissions.includes("map.position.declare") ?? false}
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
