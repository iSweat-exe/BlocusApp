import { CloseIcon, RedoIcon, TrashIcon, UndoIcon } from "@/components/icons";
import { Crosshair } from "./crosshair";

export type ToolbarError = { message: string; stale: boolean };

type Props = {
  pointCount: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  dirty: boolean;
  saving: boolean;
  error: ToolbarError | null;
  confirmingDiscard: boolean;
  onClose: () => void;
  onSave: () => void;
  onAdd: () => void;
  onMoveHere: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onConfirmDiscard: (confirming: boolean) => void;
  onReload: () => void;
};

const ROUND =
  "flex h-tap w-tap shrink-0 items-center justify-center rounded-full border border-line-strong bg-background text-foreground active:bg-foreground/10 disabled:opacity-40";

function pointsLabel(count: number): string {
  if (count === 0) return "Aucun point";
  return count === 1 ? "1 point" : `${count} points`;
}

/**
 * Controls of the route editor, laid over the map: a top bar (close, title, save) and a bottom bar with the
 * tools. Presentational: the state lives in `MapView`. Thumb-friendly: 44 px targets, the main action is the
 * widest button. The crosshair at the centre of the map shows where "Ajouter ici" puts a point.
 */
export function RouteToolbar(props: Props) {
  const { pointCount, hasSelection, saving, error, confirmingDiscard } = props;
  const hint =
    pointCount === 0
      ? "Déplace la carte, puis touche « Ajouter ici »."
      : pointCount === 1
        ? "Un tracé a besoin d'au moins 2 points."
        : hasSelection
          ? "Glisse le point, ou déplace la carte puis « Déplacer ici »."
          : "Touche un point pour le déplacer ou le supprimer.";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between">
      <Crosshair />

      <div className="pointer-events-auto relative flex items-center justify-between gap-2 border-b border-line bg-background/90 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => (props.dirty ? props.onConfirmDiscard(true) : props.onClose())}
          aria-label="Fermer l'édition"
          className={ROUND}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <p className="min-w-0 truncate text-sm font-semibold">Modifier le tracé</p>
        <button
          type="button"
          onClick={props.onSave}
          disabled={!props.canSave || !props.dirty || saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <div className="pointer-events-auto relative flex flex-col gap-2 border-t border-line bg-background/90 p-3 pb-safe-bottom backdrop-blur">
        {confirmingDiscard ? (
          <div
            role="alertdialog"
            aria-label="Abandonner les modifications ?"
            className="flex flex-col gap-2"
          >
            <p className="text-sm font-medium">Abandonner les modifications ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => props.onConfirmDiscard(false)}
                className="btn btn-outline btn-sm"
              >
                Continuer à modifier
              </button>
              <button type="button" onClick={props.onClose} className="btn btn-danger btn-sm">
                Abandonner
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="alert alert-error flex flex-col gap-2 text-xs">
                <p>{error.message}</p>
                {error.stale && (
                  <button
                    type="button"
                    onClick={props.onReload}
                    className="btn btn-outline btn-sm self-start"
                  >
                    Recharger le tracé
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={props.onUndo}
                disabled={!props.canUndo}
                aria-label="Annuler"
                className={ROUND}
              >
                <UndoIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={props.onRedo}
                disabled={!props.canRedo}
                aria-label="Rétablir"
                className={ROUND}
              >
                <RedoIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={props.onDelete}
                disabled={!hasSelection}
                aria-label="Supprimer le point"
                className={`${ROUND} text-danger`}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
              <p className="ml-auto text-right text-xs font-medium text-muted" aria-live="polite">
                {pointsLabel(pointCount)}
              </p>
            </div>
            <p className="text-xs text-muted">{hint}</p>
            <div className="flex gap-2">
              <button type="button" onClick={props.onAdd} className="btn btn-primary flex-1">
                Ajouter ici
              </button>
              {hasSelection && (
                <button type="button" onClick={props.onMoveHere} className="btn btn-outline flex-1">
                  Déplacer ici
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
