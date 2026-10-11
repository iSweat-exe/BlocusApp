/** Placeholder of the roles screen while it loads: same blocks, same heights, so nothing jumps. */
export function RolesSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Chargement des rôles et des permissions…</span>
      <div aria-hidden="true" className={`h-14 ${block}`} />
      <div aria-hidden="true" className="-mx-4 flex gap-2 overflow-hidden px-4">
        {[28, 24, 32, 36, 44].map((width, index) => (
          <div
            key={index}
            className={`h-tap shrink-0 ${block}`}
            style={{ width: `${width * 4}px` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className={`h-32 ${block}`} />
      <div aria-hidden="true" className={`h-48 ${block}`} />
    </div>
  );
}
