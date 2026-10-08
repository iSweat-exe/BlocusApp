/** Local storage key of the chosen theme (`light` or `dark`; absent = follow the system). */
export const THEME_STORAGE_KEY = "blocus.theme";

/** The three choices of the settings. `system` follows the device. */
export const THEMES = [
  { value: "system", label: "Système" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

/** Browser bar colors, kept equal to `--background` in `globals.css`. */
export const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** Returns a valid stored theme, or `"system"` for anything else (missing, tampered). */
export function normalizeTheme(value: string | null | undefined): Theme {
  return THEMES.some((theme) => theme.value === value) ? (value as Theme) : "system";
}
