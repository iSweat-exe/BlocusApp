/** Placeholder of the statistics page while it loads: same blocks as the page, so nothing jumps. */
export function StatisticsSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Chargement des statistiques…</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`h-4 w-28 ${block}`} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, tile) => (
            <div key={tile} className={`h-24 ${block}`} />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className={`h-4 w-20 ${block}`} />
        <div className={`h-11 w-full ${block}`} />
        <div className={`h-64 ${block}`} />
        <div className={`h-52 ${block}`} />
      </div>
    </div>
  );
}
