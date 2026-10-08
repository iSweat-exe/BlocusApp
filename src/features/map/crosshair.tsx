/** The crosshair at the centre of the map: where "Ajouter ici" / "Déclarer ici" puts a point. Decorative. */
export function Crosshair() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 40 40" width="40" height="40" className="text-foreground drop-shadow">
        <circle cx="20" cy="20" r="3" fill="currentColor" />
        <path
          d="M20 4v10M20 26v10M4 20h10M26 20h10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
