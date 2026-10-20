import { useId } from "react";

/**
 * The drawings of the Halloween decoration, as inline SVG. Every drawing has depth: a gradient body lit from the
 * top left, a soft reflection and a darker rim, instead of one flat fill. Each one makes its own gradient ids
 * (`useId`), so the same drawing can appear many times with different colors.
 */

/** Ghost colors: the body fades from white in the middle to `edge`, and glows with `glow` (an `r g b` triplet). */
export const GHOST_TINTS = {
  violet: { mid: "#efe6ff", edge: "#b79bff", glow: "183 155 255" },
  mint: { mid: "#e4fff3", edge: "#6fe3b4", glow: "111 227 180" },
  peach: { mid: "#fff0e4", edge: "#ffb184", glow: "255 177 132" },
} as const;
export type GhostTint = keyof typeof GHOST_TINTS;

/** Wrapped candy colors: light (reflection side), base, dark (rim). */
export const CANDY_TONES = {
  orange: { light: "#ffd29a", base: "#ff8a1f", dark: "#b94a05" },
  purple: { light: "#e4d8ff", base: "#a47bff", dark: "#5d34c4" },
  green: { light: "#d4f9a8", base: "#7fdc3f", dark: "#3f8d14" },
  pink: { light: "#ffd0e8", base: "#ff6fb0", dark: "#b8206f" },
} as const;
export type CandyTone = keyof typeof CANDY_TONES;

/** Prefix for gradient ids: `useId` returns characters (`:`) that are awkward inside `url(#…)`. */
function useSvgId(): string {
  return `hw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** A ghost: translucent tail, cheeks, shiny eyes that follow the cursor and a mouth that opens when it gets close. */
export function Ghost({ tint }: { tint: GhostTint }) {
  const id = useSvgId();
  const { mid, edge } = GHOST_TINTS[tint];
  return (
    <svg viewBox="0 0 64 72" className="size-full overflow-visible" focusable="false">
      <defs>
        <radialGradient id={`${id}b`} cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={edge} />
        </radialGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.35" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="72">
          <rect width="64" height="72" fill={`url(#${id}t)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path
          d="M10 62V30C10 16 20 6 32 6s22 10 22 24v32l-7-6-7 6-8-6-8 6-7-6-7 6Z"
          fill={`url(#${id}b)`}
        />
        <path
          d="M14 30C14 19 21 11 30 10"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
      <ellipse cx="18.5" cy="40" rx="4.2" ry="2.5" fill="#ff8fc4" opacity="0.5" />
      <ellipse cx="45.5" cy="40" rx="4.2" ry="2.5" fill="#ff8fc4" opacity="0.5" />
      <g className="halloween-eyes">
        <ellipse cx="25" cy="30" rx="3.6" ry="5" fill="#1a0b2e" />
        <ellipse cx="39" cy="30" rx="3.6" ry="5" fill="#1a0b2e" />
        <circle cx="26.2" cy="28" r="1.3" fill="#ffffff" />
        <circle cx="40.2" cy="28" r="1.3" fill="#ffffff" />
      </g>
      <ellipse className="halloween-mouth" cx="32" cy="43" rx="4" ry="5.2" fill="#1a0b2e" />
    </svg>
  );
}

/** A wrapped sweet: glossy body, twisted cellophane ends with fold lines, two stripes. */
export function WrappedCandy({ tone }: { tone: CandyTone }) {
  const id = useSvgId();
  const { light, base, dark } = CANDY_TONES[tone];
  return (
    <svg viewBox="0 0 64 40" className="size-full overflow-visible" focusable="false">
      <defs>
        <radialGradient id={`${id}b`} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
      </defs>
      <path d="M22 20 3 5 8 20 3 35Z" fill={`url(#${id}w)`} opacity="0.85" />
      <path d="M42 20 61 5 56 20 61 35Z" fill={`url(#${id}w)`} opacity="0.85" />
      <path
        d="M22 20 6 11M22 20 8 20M22 20 6 29M42 20 58 11M42 20 56 20M42 20 58 29"
        stroke={dark}
        strokeWidth="0.9"
        opacity="0.55"
        strokeLinecap="round"
      />
      <ellipse cx="32" cy="20" rx="17" ry="14" fill={`url(#${id}b)`} />
      <path d="M23 7.5c6 7 6 18-2 25" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.55" />
      <path d="M36 6.5c6 8 7 19 0 27" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.55" />
      <ellipse
        cx="25"
        cy="12.5"
        rx="6.5"
        ry="2.6"
        fill="#ffffff"
        opacity="0.6"
        transform="rotate(-24 25 12.5)"
      />
    </svg>
  );
}

/** Candy corn with soft bands (white tip, orange, yellow) and a reflection along the left edge. */
export function CandyCorn() {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 40 48" className="size-full overflow-visible" focusable="false">
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.27" stopColor="#fff1d4" />
          <stop offset="0.33" stopColor="#ffb24a" />
          <stop offset="0.62" stopColor="#ff8a1f" />
          <stop offset="0.68" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#ffbd1a" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#7a2b00" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M20 2c6 0 16 38 16 42a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4C4 40 14 2 20 2Z"
        fill={`url(#${id}c)`}
      />
      <path
        d="M20 2c6 0 16 38 16 42a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4C4 40 14 2 20 2Z"
        fill={`url(#${id}s)`}
      />
      <path
        d="M15 12C12 24 9.500 33 9 40"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** A lit jack-o'-lantern: ribbed body, stem, and a face that flickers like a candle. */
export function Pumpkin() {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 64 60" className="size-full overflow-visible" focusable="false">
      <defs>
        <radialGradient id={`${id}p`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffb14d" />
          <stop offset="0.6" stopColor="#ff7a12" />
          <stop offset="1" stopColor="#b13d00" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="35" rx="14" ry="21" fill={`url(#${id}p)`} />
      <ellipse cx="44" cy="35" rx="14" ry="21" fill={`url(#${id}p)`} />
      <ellipse cx="32" cy="35" rx="15" ry="22" fill={`url(#${id}p)`} />
      <path
        d="M24 16C20 28 20 42 24 54M40 16C44 28 44 42 40 54"
        fill="none"
        stroke="#8f3000"
        strokeWidth="1.2"
        opacity="0.55"
      />
      <path d="M30 14c-1-8 6-11 8-10l1 3c-5 1-4 5-4 7Z" fill="#5f8a2c" />
      <g className="halloween-flicker">
        <path d="M19 28h8l-4 8Z" fill="#ffd84a" />
        <path d="M37 28h8l-4 8Z" fill="#ffd84a" />
        <path d="M30 38h4l-2 4Z" fill="#ffd84a" />
        <path d="M18 44Q32 57 46 44L43 42 39 46 35 43 32 47 29 43 25 46 21 42Z" fill="#ffd84a" />
      </g>
    </svg>
  );
}

/** A spider hanging from the cobweb on its thread. */
export function Spider() {
  return (
    <svg viewBox="0 0 40 70" className="size-full overflow-visible" focusable="false">
      <path d="M20 0V32" stroke="#e9ddff" strokeWidth="1" opacity="0.5" />
      <path
        d="M14 38 6 31 2 38M13 41 3 42M14 44 5 52M15 47 9 59M26 38l8-7 4 7M27 41l10 1M26 44l9 8M25 47l6 12"
        fill="none"
        stroke="#2a1450"
        strokeWidth="1.600"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="20"
        cy="43"
        rx="7"
        ry="8.500"
        fill="#1c0d38"
        stroke="#7c5cd6"
        strokeWidth="0.8"
      />
      <circle cx="20" cy="33" r="4.500" fill="#1c0d38" stroke="#7c5cd6" strokeWidth="0.8" />
      <circle cx="18.300" cy="32.500" r="1" fill="#ff6a6a" />
      <circle cx="21.700" cy="32.500" r="1" fill="#ff6a6a" />
      <ellipse cx="18" cy="41" rx="2" ry="3" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}

/** A four-pointed twinkle. */
export function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" focusable="false">
      <path d="M12 0 14 10 24 12 14 14 12 24 10 14 0 12 10 10Z" fill="#ffe9b3" />
    </svg>
  );
}

/** Spider web in the top-left corner: the only piece that stays when motion is reduced. */
export function Cobweb() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="halloween-cobweb absolute top-0 left-0 size-28 lg:size-36"
      focusable="false"
      fill="none"
      stroke="#e9ddff"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M0 0 120 0M0 0 108 50M0 0 84 84M0 0 50 108M0 0 0 120" />
      <path d="M30 0Q17 17 0 30M60 0Q33 33 0 60M90 0Q50 50 0 90M118 0Q68 68 0 118" />
    </svg>
  );
}
