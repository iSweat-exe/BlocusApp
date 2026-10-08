import { MapLoader } from "@/features/map/map-loader";

export default function MapPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Carte</h1>
        {/* Route and declared position are not built yet (A-126a to A-126c). */}
        <span role="status" className="chip chip-accent gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          En développement
        </span>
      </div>
      <MapLoader />
    </div>
  );
}
