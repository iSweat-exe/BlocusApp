import { FullScreenDialog } from "@/components/full-screen-dialog";
import { PinIcon } from "@/components/icons";
import type { MapPosition } from "@/lib/data/map-positions";
import { formatAgo, formatDeclared, STALE_AFTER_MS } from "./position-time";

type Props = {
  /** The current position, then the earlier ones, newest first. */
  positions: MapPosition[];
  now: number;
  /** Moves the map to the current position. */
  onShow: () => void;
};

/**
 * Card showing the latest declared position of the demonstration (label, how long ago, a shortcut to see it on
 * the map) and a history sheet. Only declared positions are shown: never the position of ordinary users.
 */
export function PositionPanel({ positions, now, onShow }: Props) {
  const current = positions[0];
  if (!current) return null;
  const stale = now - Date.parse(current.declaredAt) > STALE_AFTER_MS;

  return (
    <section
      aria-label="Position de la manifestation"
      className="pointer-events-auto flex min-w-0 max-w-[calc(100%-4rem)] flex-1 flex-col gap-2 rounded-card border border-line-strong bg-background/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-2.5">
        <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {current.label || "Position de la manifestation"}
          </p>
          <p className="text-xs text-muted">
            {formatAgo(current.declaredAt, now)} · {formatDeclared(current.declaredAt, now)}
          </p>
          {stale && <p className="mt-1 text-xs font-medium text-danger">Peut-être dépassée</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onShow} className="btn btn-outline btn-sm flex-1">
          Voir
        </button>
        {positions.length > 1 && (
          <FullScreenDialog
            triggerLabel="Historique"
            title="Positions déclarées"
            triggerClassName="btn btn-outline btn-sm flex-1"
          >
            <ol className="flex flex-col gap-2 pb-4">
              {positions.map((position, index) => (
                <li key={position.id} className="card flex items-center gap-3 p-3">
                  <PinIcon
                    className={`h-5 w-5 shrink-0 ${index === 0 ? "text-accent" : "text-faint"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {position.label || "Position déclarée"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDeclared(position.declaredAt, now)} ·{" "}
                      {formatAgo(position.declaredAt, now)}
                    </p>
                  </div>
                  {index === 0 && <span className="chip chip-accent shrink-0">Actuelle</span>}
                </li>
              ))}
            </ol>
          </FullScreenDialog>
        )}
      </div>
    </section>
  );
}
