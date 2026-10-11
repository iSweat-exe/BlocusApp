/** Placeholder of the health page while it measures: same blocks as the page, so nothing jumps. */
export function HealthSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Mesure en cours…</span>
      <div
        aria-hidden="true"
        className="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:gap-6"
      >
        <div className="size-36 shrink-0 animate-pulse rounded-full bg-foreground/10" />
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <div className={`h-4 w-24 ${block}`} />
          <div className={`h-7 w-32 ${block}`} />
          <div className={`h-3 w-28 ${block}`} />
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`h-4 w-20 ${block}`} />
        <div className="card divide-y divide-line overflow-hidden">
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} className="flex items-center gap-3 px-4 py-3">
              <div className="size-2.5 shrink-0 animate-pulse rounded-full bg-foreground/10" />
              <div className="flex flex-1 flex-col gap-2">
                <div className={`h-4 w-32 ${block}`} />
                <div className={`h-3 w-48 max-w-full ${block}`} />
              </div>
              <div className={`h-4 w-14 ${block}`} />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div className={`h-24 ${block}`} />
        <div className={`h-24 ${block}`} />
      </div>
    </div>
  );
}
