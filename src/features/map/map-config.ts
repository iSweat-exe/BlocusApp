/**
 * Central configuration of the map. Everything that depends on a provider or on the city lives here, so
 * changing the tile provider or the area is a one-file change.
 */

/** Origin that serves the style, tiles, glyphs and sprites (added to the CSP in `next.config.ts`). */
export const TILES_ORIGIN = "https://tiles.openfreemap.org";

/**
 * OpenFreeMap vector styles: free, no account, no API key, no usage limit. `liberty` is the colourful default;
 * `positron` is a light grey basemap that the dark theme inverts (see `MapView`).
 */
export const MAP_STYLES = {
  light: `${TILES_ORIGIN}/styles/liberty`,
  dark: `${TILES_ORIGIN}/styles/positron`,
} as const;

export type MapTheme = keyof typeof MAP_STYLES;

/**
 * Where the map opens. TODO(city X): replace by the demonstration's city once decided (centre as
 * `[longitude, latitude]`). Until then the map shows mainland France.
 */
export const DEFAULT_VIEW = { center: [2.35, 46.6] as [number, number], zoom: 5 };

/** Zoom used when the map flies to the user's own position. */
export const LOCATE_ZOOM = 15;
