import type { ReactNode } from "react";
import { WrenchIcon } from "./icons";

/**
 * "Under development" state for a page that is not built yet: a badge, an illustration slot, a short
 * explanation and the list of what is coming. Server Component, design-system classes only.
 */
export function WorkInProgress({
  title,
  description,
  icon,
  upcoming,
}: {
  /** Name of the feature, e.g. "Carte". Also the accessible name of the status region. */
  title: string;
  description: string;
  /** Large icon of the feature (decorative). */
  icon: ReactNode;
  /** What is coming, one short line each. */
  upcoming: readonly string[];
}) {
  return (
    <section
      aria-label={`${title} : en développement`}
      className="flex flex-col items-center gap-section text-center"
    >
      <div className="flex flex-col items-center gap-4 pt-4">
        <div className="relative">
          <div
            aria-hidden="true"
            className="flex h-28 w-28 items-center justify-center rounded-sheet border border-line bg-surface text-accent [&_svg]:h-14 [&_svg]:w-14"
          >
            {icon}
          </div>
          <span
            aria-hidden="true"
            className="absolute -right-2 -bottom-2 flex h-11 w-11 items-center justify-center rounded-full border-4 border-background bg-accent text-accent-ink"
          >
            <WrenchIcon className="h-5 w-5" />
          </span>
        </div>

        <span role="status" className="chip chip-accent gap-1.5 text-sm">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          En développement
        </span>

        <div className="flex max-w-sm flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 text-left">
        <h3 className="section-title">Bientôt disponible</h3>
        <ul className="card divide-y divide-line overflow-hidden">
          {upcoming.map((item) => (
            <li
              key={item}
              className="flex min-h-control items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm font-medium">{item}</span>
              <span className="chip shrink-0 text-faint">Bientôt</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
