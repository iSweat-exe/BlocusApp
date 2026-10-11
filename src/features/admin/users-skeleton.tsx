/** Placeholder of the users page while it loads: same blocks, same heights, so nothing jumps. */
export function UsersSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Chargement des utilisateurs…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className={`h-control ${block}`} />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4">
          {[14, 24, 28, 28, 24].map((width, index) => (
            <div
              key={index}
              className={`h-tap shrink-0 ${block}`}
              style={{ width: `${width * 4}px` }}
            />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="card divide-y divide-line overflow-hidden">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <div className="size-11 shrink-0 animate-pulse rounded-control bg-foreground/10" />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-4 w-32 ${block}`} />
              <div className={`h-3.5 w-20 ${block}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
