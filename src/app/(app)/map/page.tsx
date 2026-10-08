import { connection } from "next/server";
import { Suspense } from "react";
import { MapLoader, MapSkeleton } from "@/features/map/map-loader";
import { getCurrentRoute } from "@/lib/data/map";
import { getSessionPermissions } from "@/server/session";

async function MapContent() {
  // The shared cache holds data that does not depend on the request: read it at request time, not at build time.
  await connection();
  const [route, session] = await Promise.all([getCurrentRoute(), getSessionPermissions()]);
  const current = route.ok ? route.value : null;

  return (
    <MapLoader
      route={current ? { id: current.id, points: current.points } : null}
      // Display only: the Server Action and the database re-check the permission.
      canEditRoute={session?.permissions.includes("map.route.edit") ?? false}
    />
  );
}

export default function MapPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Carte</h1>
        {/* The declared position is not built yet (A-126c). */}
        <span role="status" className="chip chip-accent gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          En développement
        </span>
      </div>
      <Suspense fallback={<MapSkeleton />}>
        <MapContent />
      </Suspense>
    </div>
  );
}
