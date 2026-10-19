"use client";

import { startTransition, useOptimistic, useState } from "react";
import { listReactors, toggleReaction } from "./reaction-actions";
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  type ReactionEmoji,
  type ReactionKind,
  type ReactionState,
  type ReactorsByEmoji,
  toggleReactionState,
} from "./reactions";

const PILL = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm";
const PILL_IDLE = "border-line bg-surface text-foreground/80";
const PILL_MINE = "border-accent/50 bg-accent/15 text-accent";
// Tap feedback only; no movement for people who asked for less of it.
// 36 px pills: a pseudo-element grows the touch area to 44 px (rows are 8 px apart, so areas never overlap).
const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']";
const PRESS = "transition-transform active:scale-[0.96] motion-reduce:transition-none";

/**
 * Discord-style reactions under a public post or an event: one pill per emoji already used (highlighted when the
 * viewer used it) and a "+" that opens the palette. Tapping updates the screen at once and the server confirms; if
 * it refuses, the change is undone and the reason shown. Guests see the totals but cannot react (`canReact` false),
 * and neither see who reacted: that list is for signed-in people (`canReact`), opened on demand.
 */
export function ReactionBar({
  kind,
  targetId,
  state,
  canReact,
  className = "mt-3",
}: {
  kind: ReactionKind;
  targetId: string;
  state: ReactionState;
  canReact: boolean;
  /** Spacing around the bar (under a post it sits 12 px below the text). */
  className?: string;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(state, toggleReactionState);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `null` = list closed; `"loading"` while it is being read; otherwise who reacted, by emoji.
  const [reactors, setReactors] = useState<ReactorsByEmoji | "loading" | null>(null);

  async function toggleReactors() {
    if (reactors !== null) {
      setReactors(null);
      return;
    }
    setError(null);
    setReactors("loading");
    const result = await listReactors(kind, targetId);
    if (result.ok) {
      setReactors(result.reactors);
    } else {
      setReactors(null);
      setError(result.message);
    }
  }

  function react(emoji: ReactionEmoji) {
    setError(null);
    setPickerOpen(false);
    startTransition(async () => {
      applyOptimistic(emoji);
      const result = await toggleReaction(kind, targetId, emoji);
      if (!result.ok) setError(result.message);
    });
  }

  const used = REACTION_EMOJIS.filter((emoji) => (optimistic.counts[emoji] ?? 0) > 0);
  if (used.length === 0 && !canReact) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <ul aria-label="Réactions" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {used.map((emoji) => {
          const count = optimistic.counts[emoji] ?? 0;
          const mine = optimistic.mine.includes(emoji);
          const content = (
            <>
              <span aria-hidden="true">{emoji}</span>
              <span className="text-xs font-semibold tabular-nums">{count}</span>
            </>
          );
          return (
            <li key={emoji}>
              {canReact ? (
                <button
                  type="button"
                  onClick={() => react(emoji)}
                  aria-pressed={mine}
                  aria-label={`${REACTION_LABELS[emoji]} : ${count}`}
                  className={`${PILL} ${PRESS} ${HIT} min-h-9 ${mine ? PILL_MINE : PILL_IDLE} [@media(hover:hover)]:hover:border-accent/50`}
                >
                  {content}
                </button>
              ) : (
                <span
                  role="img"
                  aria-label={`${REACTION_LABELS[emoji]} : ${count}`}
                  className={`${PILL} ${PILL_IDLE}`}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
        {canReact && (
          <li>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-label="Ajouter une réaction"
              className={`${PILL} ${PRESS} ${HIT} min-h-9 ${PILL_IDLE} text-muted [@media(hover:hover)]:hover:text-foreground`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {pickerOpen ? "×" : "+"}
              </span>
              <span aria-hidden="true">🙂</span>
            </button>
          </li>
        )}
      </ul>

      {pickerOpen && (
        <ul
          aria-label="Choisir une réaction"
          className="flex animate-fade-in flex-wrap gap-1 rounded-card border border-line bg-surface p-1"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <li key={emoji}>
              <button
                type="button"
                onClick={() => react(emoji)}
                aria-label={REACTION_LABELS[emoji]}
                aria-pressed={optimistic.mine.includes(emoji)}
                className={`${PRESS} inline-flex size-10 items-center justify-center rounded-control text-xl active:bg-foreground/10 aria-pressed:bg-accent/15 [@media(hover:hover)]:hover:bg-foreground/10`}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canReact && used.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => void toggleReactors()}
            aria-expanded={reactors !== null}
            className="min-h-tap self-start px-1 text-xs font-medium text-muted underline-offset-2 [@media(hover:hover)]:hover:underline"
          >
            {reactors === null ? "Qui a réagi ?" : "Masquer"}
          </button>
          {reactors === "loading" && <p className="px-1 text-xs text-muted">Chargement…</p>}
          {reactors !== null && reactors !== "loading" && (
            <ul aria-label="Qui a réagi" className="card flex animate-fade-in flex-col gap-1.5 p-3">
              {REACTION_EMOJIS.filter((emoji) => reactors[emoji]).map((emoji) => (
                <li key={emoji} className="flex items-start gap-2 text-sm">
                  <span aria-hidden="true">{emoji}</span>
                  <span className="sr-only">{REACTION_LABELS[emoji]} :</span>
                  <span className="min-w-0 break-words">{reactors[emoji]?.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
    </div>
  );
}
