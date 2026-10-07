/** Local storage key of the user's accent color (a `#rrggbb` string; absent = the default red). */
export const ACCENT_STORAGE_KEY = "blocus.accent";

/** Ready-made accent colors offered in the settings (the first one is the app default). */
export const ACCENT_PRESETS = [
  { hex: "#ef4444", label: "Rouge" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#eab308", label: "Jaune" },
  { hex: "#22c55e", label: "Vert" },
  { hex: "#14b8a6", label: "Turquoise" },
  { hex: "#3b82f6", label: "Bleu" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#a855f7", label: "Violet" },
  { hex: "#ec4899", label: "Rose" },
  { hex: "#64748b", label: "Ardoise" },
] as const;

export const DEFAULT_ACCENT: string = ACCENT_PRESETS[0].hex;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Returns `input` as a lowercase `#rrggbb`, or `null` when it is not a valid color. Accepts a missing
 * `#` and the 3-digit shorthand, because users type colors by hand. The value ends up in a CSS variable,
 * so anything else is rejected rather than escaped.
 */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = `#${[...value.slice(1)].map((digit) => digit + digit).join("")}`;
  }
  return HEX.test(value) ? value : null;
}

/** CSS variables derived from one accent color. */
export type AccentVars = { accent: string; strong: string; ink: string };

/**
 * Derives the pressed color (15 % darker) and a readable text color (dark on light accents, white on dark
 * ones) from the accent. Keep in sync with `ACCENT_BOOT_SCRIPT`, which repeats this before first paint.
 */
export function accentVars(hex: string): AccentVars {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const darker = (channel: number) => Math.round(channel * 0.85);
  const strong = `#${[r, g, b].map((c) => darker(c).toString(16).padStart(2, "0")).join("")}`;
  return { accent: hex, strong, ink: luminance > 0.6 ? "#111111" : "#ffffff" };
}
