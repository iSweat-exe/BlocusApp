import type { CSSProperties } from "react";
import { accentVars } from "@/features/settings/accent";

/** A look reserved for some profiles. */
export type ProfileTheme = {
  key: "love";
  /** Accent color of the whole profile page (`#rrggbb`). */
  accent: string;
  /** Small line shown under the pseudo. */
  message: string;
};

const LOVE: ProfileTheme = {
  key: "love",
  accent: "#ec4899",
  message: "Un petit quelque chose rien que pour toi mon coeur, mouah mawww",
};

/**
 * Accounts with a special profile, by user id (lower case). Adding one is one line here and a deploy; the page
 * itself only reads the id of the profile it shows, so nobody can ask for a theme.
 */
const THEMED_PROFILES: Readonly<Record<string, ProfileTheme>> = {
  "c19db495-1252-4698-af47-819c4240fd48": LOVE,
};

/** The theme of a profile, or `null` for everybody else. */
export function profileThemeOf(userId: string): ProfileTheme | null {
  return THEMED_PROFILES[userId.toLowerCase()] ?? null;
}

/** CSS variables that recolor a subtree with the accent of a theme (same variables as the settings page). */
export function profileThemeStyle(theme: ProfileTheme): CSSProperties {
  const vars = accentVars(theme.accent);
  return {
    "--accent": vars.accent,
    "--accent-strong": vars.strong,
    "--accent-ink": vars.ink,
  } as CSSProperties;
}
