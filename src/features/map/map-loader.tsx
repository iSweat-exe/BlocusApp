"use client";

import dynamic from "next/dynamic";

/**
 * Loads the map on demand: MapLibre (~250 KB compressed) is a separate chunk fetched only on `/map`, and it
 * needs WebGL so it never renders on the server.
 */
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-card border border-line bg-surface text-sm text-muted">
      Chargement de la carte…
    </div>
  ),
});

export function MapLoader() {
  return <MapView />;
}
