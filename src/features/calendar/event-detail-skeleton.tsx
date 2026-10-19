import { EventBackLink } from "./event-back-link";

/** Placeholder of an event page while it loads: same blocks as the page, so nothing jumps when it arrives. */
export function EventDetailSkeleton() {
  const block = "animate-pulse rounded-control bg-foreground/10";
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-section">
      <span className="sr-only">Chargement de l&apos;événement…</span>
      <EventBackLink />
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className={`h-7 w-24 rounded-full ${block}`} />
        <div className={`h-8 w-3/4 ${block}`} />
      </div>
      <div aria-hidden="true" className="card divide-y divide-line overflow-hidden">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3.5 px-4 py-3.5">
            <div className={`size-10 shrink-0 ${block}`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-3 w-12 ${block}`} />
              <div className={`h-4 w-2/3 ${block}`} />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`h-4 w-24 ${block}`} />
        <div className={`h-24 w-full rounded-card ${block}`} />
      </div>
    </div>
  );
}
