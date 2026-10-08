import { FullScreenDialog } from "@/components/full-screen-dialog";
import { CloseIcon, PinIcon } from "@/components/icons";
import type { MapPosition } from "@/lib/data/map-positions";
import { formatAgo, formatDeclared, STALE_AFTER_MS } from "./position-time";

type Props = {
  /** The current position. */
  position: MapPosition;
  /** The current position first, then the earlier declarations (removed ones included), newest first. */
  history: MapPosition[];
  now: number;
  /** The person who declared it (or an administrator) may remove it. */
  canRemove: boolean;
  confirmingRemoval: boolean;
  removing: boolean;
  error: string | null;
  onAskRemove: (asking: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Where the position is, as a link anyone can open in a maps app (OpenStreetMap, no account needed). */
function mapLink(position: Pick<MapPosition, "lat" | "lng">): string {
  const { lat, lng } = position;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * Information card opened by tapping the position marker: the place, when it was declared, its coordinates, a link
 * to open it in a maps app and the history. Visible to everybody; the removal is offered only to the person who
 * declared it (see `remove_map_position`). Laid over the bottom of the map.
 */
export function PositionInfo(props: Props) {
  const { position, history, now, error } = props;
  const stale = now - Date.parse(position.declaredAt) > STALE_AFTER_MS;

  return (
    <section
      aria-label="Position de la manifestation"
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex flex-col gap-3 rounded-sheet border border-line-strong bg-background/95 p-4 pb-safe-bottom shadow-2xl backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
          <PinIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Position de la manifestation
          </p>
          <h2 className="break-words text-base font-semibold">
            {position.label || "Lieu non précisé"}
          </h2>
          <p className="text-sm text-muted">
            Déclarée {formatAgo(position.declaredAt, now)} ·{" "}
            {formatDeclared(position.declaredAt, now)}
          </p>
          {stale && <p className="mt-1 text-xs font-medium text-danger">Peut-être dépassée</p>}
          <p className="mt-1 font-mono text-xs text-faint">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Fermer les informations"
          className="flex h-tap w-tap shrink-0 items-center justify-center rounded-full bg-foreground/10 active:bg-foreground/15"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <p role="alert" className="alert alert-error text-xs">
          {error}
        </p>
      )}

      {props.confirmingRemoval ? (
        <div role="alertdialog" aria-label="Retirer la position ?" className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Retirer cette position ? Elle ne sera plus affichée sur la carte.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => props.onAskRemove(false)}
              className="btn btn-outline btn-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={props.onRemove}
              disabled={props.removing}
              className="btn btn-danger btn-sm"
            >
              {props.removing ? "Retrait…" : "Retirer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <a
            href={mapLink(position)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm flex-1"
          >
            Voir le plan
          </a>
          {history.length > 1 && (
            <FullScreenDialog
              triggerLabel="Historique"
              title="Positions déclarées"
              triggerClassName="btn btn-outline btn-sm flex-1"
            >
              <ol className="flex flex-col gap-2 pb-4">
                {history.map((item, index) => (
                  <li
                    key={item.id}
                    className={`card flex items-center gap-3 p-3 ${item.removedAt ? "opacity-60" : ""}`}
                  >
                    <PinIcon
                      className={`h-5 w-5 shrink-0 ${index === 0 && !item.removedAt ? "text-accent" : "text-faint"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.label || "Lieu non précisé"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDeclared(item.declaredAt, now)} · {formatAgo(item.declaredAt, now)}
                      </p>
                    </div>
                    {item.removedAt ? (
                      <span className="chip shrink-0">Retirée</span>
                    ) : (
                      index === 0 && <span className="chip chip-accent shrink-0">Actuelle</span>
                    )}
                  </li>
                ))}
              </ol>
            </FullScreenDialog>
          )}
          {props.canRemove && (
            <button
              type="button"
              onClick={() => props.onAskRemove(true)}
              className="btn btn-danger btn-sm w-full"
            >
              Retirer la position
            </button>
          )}
        </div>
      )}
    </section>
  );
}
