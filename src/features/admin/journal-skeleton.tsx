/** Placeholder of the journal while it loads: same blocks, same heights, so nothing jumps. */
export function JournalSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Chargement du journal…</span>
      <div aria-hidden="true" className="-mx-4 flex gap-2 overflow-hidden px-4">
        {[16, 20, 28, 26, 28, 20].map((width, index) => (
          <div
            key={index}
            className={`h-tap shrink-0 ${block}`}
            style={{ width: `${width * 4}px` }}
          />
        ))}
      </div>
      {[3, 2].map((rows, group) => (
        <div key={group} aria-hidden="true" className="flex flex-col gap-2">
          <div className={`h-4 w-28 ${block}`} />
          <div className="card divide-y divide-line overflow-hidden">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex gap-3 px-4 py-3">
                <div className="size-9 shrink-0 animate-pulse rounded-full bg-foreground/10" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className={`h-4 w-full ${block}`} />
                  <div className={`h-3 w-24 ${block}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
