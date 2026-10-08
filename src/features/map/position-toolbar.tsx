import { CloseIcon } from "@/components/icons";
import { Crosshair } from "./crosshair";

type Props = {
  label: string;
  onLabelChange: (label: string) => void;
  declaring: boolean;
  locating: boolean;
  error: string | null;
  onDeclare: () => void;
  onUseGps: () => void;
  onClose: () => void;
};

/** Longest label, same as the database. */
export const POSITION_LABEL_MAX = 80;

/**
 * Controls for declaring the position of the demonstration, laid over the map: a top bar with the title, a
 * crosshair at the centre, and a bottom bar with an optional label, the GPS shortcut and the confirmation.
 * Nothing is sent until "Déclarer ici" is pressed: the GPS button only moves the map to the manager's own
 * position, so they can check it first.
 */
export function PositionToolbar(props: Props) {
  const { declaring, locating, error } = props;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between">
      <Crosshair />

      <div className="pointer-events-auto relative flex items-center justify-between gap-2 border-b border-line bg-background/90 p-2 backdrop-blur">
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Fermer la déclaration"
          className="flex h-tap w-tap shrink-0 items-center justify-center rounded-full border border-line-strong bg-background active:bg-foreground/10"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate pr-2 text-center text-sm font-semibold">
          Déclarer la position
        </p>
        <span className="w-tap shrink-0" aria-hidden="true" />
      </div>

      <div className="pointer-events-auto relative flex flex-col gap-3 border-t border-line bg-background/90 p-3 pb-safe-bottom backdrop-blur">
        {error && (
          <p role="alert" className="alert alert-error text-xs">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">
          Déplace la carte pour placer le viseur sur la manifestation. Rien n&apos;est envoyé avant
          de valider.
        </p>
        <label className="field-label">
          <span>
            Lieu <span className="font-normal text-faint">(facultatif)</span>
          </span>
          <input
            value={props.label}
            onChange={(event) => props.onLabelChange(event.target.value)}
            maxLength={POSITION_LABEL_MAX}
            placeholder="Ex. Place de la République"
            className="field min-h-control-sm text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onUseGps}
            disabled={locating}
            className="btn btn-outline flex-1 text-sm"
          >
            {locating ? "Recherche…" : "Ma position"}
          </button>
          <button
            type="button"
            onClick={props.onDeclare}
            disabled={declaring}
            className="btn btn-primary flex-1"
          >
            {declaring ? "Envoi…" : "Déclarer ici"}
          </button>
        </div>
      </div>
    </div>
  );
}
