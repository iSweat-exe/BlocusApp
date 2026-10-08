"use client";

import dynamic from "next/dynamic";
import type { MapPosition } from "@/lib/data/map-positions";
import type { LngLat } from "@/lib/map-route";

/**
 * Loads the map on demand: MapLibre (~280 KB compressed) is a separate chunk fetched only on `/map`, and it
 * needs WebGL so it never renders on the server.
 */
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/** Placeholder with the map's size, shown while the map code loads (no layout shift). */
export function MapSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-card border border-line bg-surface text-sm text-muted">
      Chargement de la carte…
    </div>
  );
}

export function MapLoader(props: {
  route: { id: string; points: LngLat[] } | null;
  canEditRoute: boolean;
  positions: MapPosition[];
  canDeclarePosition: boolean;
}) {
  return <MapView {...props} />;
}
