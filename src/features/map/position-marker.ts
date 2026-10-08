/**
 * The marker of the current position: a real DOM button (not a map layer), so it keeps its colour in the dark
 * theme (the dark basemap is an inverted canvas), has an accessible name, and takes taps. Bright accent disc
 * with a white border, a pin, and a pulsing ring so it stands out from the route. The markup is static: no
 * user data is ever put in `innerHTML`.
 */
export function createPositionMarker(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-position-marker";
  button.innerHTML =
    '<span class="map-position-pulse"></span>' +
    '<span class="map-position-disc"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg></span>';
  setPositionMarkerLabel(button, label);
  return button;
}

/** Updates the accessible name when the declared place changes. */
export function setPositionMarkerLabel(button: HTMLButtonElement, label: string): void {
  button.setAttribute(
    "aria-label",
    label
      ? `Position de la manifestation : ${label}. Afficher les informations`
      : "Position de la manifestation. Afficher les informations",
  );
}
