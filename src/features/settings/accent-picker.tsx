"use client";

import { useState, useSyncExternalStore } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, normalizeHex } from "./accent";
import { readAccent, readServerAccent, subscribeToAccent, writeAccent } from "./accent-store";

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/**
 * Accent color settings: preset swatches, a free color (native picker + hex field) and a live preview.
 * The choice is stored on this device (localStorage) and applied right away to the whole app.
 */
export function AccentPicker() {
  const saved = useSyncExternalStore(subscribeToAccent, readAccent, readServerAccent);
  const current = saved ?? DEFAULT_ACCENT;
  const isPreset = ACCENT_PRESETS.some((preset) => preset.hex === current);
  // What the user is typing in the hex field; `null` = show the current color.
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? current;
  const invalid = typed !== null && normalizeHex(typed) === null;

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Couleurs prédéfinies" className="grid grid-cols-5 gap-3">
        {ACCENT_PRESETS.map((preset) => {
          const selected = preset.hex === current;
          return (
            <button
              key={preset.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={preset.label}
              onClick={() => {
                setTyped(null);
                writeAccent(preset.hex === DEFAULT_ACCENT ? null : preset.hex);
              }}
              style={{ backgroundColor: preset.hex }}
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm active:scale-95 ${
                selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
              }`}
            >
              {selected && <Check />}
            </button>
          );
        })}
      </div>

      <div className="card flex items-center gap-3 p-3">
        <label
          className={`relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line-strong ${
            !isPreset ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
          }`}
          style={{
            background: isPreset
              ? "conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)"
              : current,
          }}
        >
          <span className="sr-only">Choisir une couleur personnalisée</span>
          <input
            type="color"
            value={current}
            onChange={(event) => {
              setTyped(null);
              writeAccent(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="accent-hex" className="text-sm font-medium">
            Couleur personnalisée
          </label>
          <input
            id="accent-hex"
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={7}
            value={shown}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              const next = event.target.value;
              setTyped(next);
              const hex = normalizeHex(next);
              if (hex) writeAccent(hex);
            }}
            onBlur={() => setTyped(null)}
            className="field min-h-control-sm font-mono text-sm uppercase"
          />
          {invalid && <p className="field-error">Format attendu : #RRGGBB</p>}
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-4" aria-label="Aperçu">
        <p className="section-title !px-0">Aperçu</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="btn btn-primary btn-sm pointer-events-none">Bouton</span>
          <span className="chip chip-accent">Pastille</span>
          <span className="flex h-8 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Check />
          </span>
        </div>
      </div>

      {saved && (
        <button
          type="button"
          onClick={() => {
            setTyped(null);
            writeAccent(null);
          }}
          className="btn btn-outline"
        >
          Rétablir le rouge d&apos;origine
        </button>
      )}
    </div>
  );
}
