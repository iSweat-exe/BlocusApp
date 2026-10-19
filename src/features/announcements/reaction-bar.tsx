"use client";

import { startTransition, useOptimistic, useState } from "react";
import { toggleReaction } from "./reaction-actions";
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  type ReactionEmoji,
  type ReactionState,
  toggleReactionState,
} from "./reactions";

const PILL = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm";
const PILL_IDLE = "border-line bg-surface text-foreground/80";
const PILL_MINE = "border-accent/50 bg-accent/15 text-accent";
// Tap feedback only; no movement for people who asked for less of it.
const PRESS = "transition-transform active:scale-90 motion-reduce:transition-none";

/**
 * Discord-style reactions under a public post: one pill per emoji already used (highlighted when the viewer used
 * it) and a "+" that opens the palette. Tapping updates the screen at once and the server confirms; if it
 * refuses, the change is undone and the reason shown. Guests see the totals but cannot react (`canReact` false).
 */
export function ReactionBar({
  postId,
  state,
  canReact,
}: {
  postId: string;
  state: ReactionState;
  canReact: boolean;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(state, toggleReactionState);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function react(emoji: ReactionEmoji) {
    setError(null);
    setPickerOpen(false);
    startTransition(async () => {
      applyOptimistic(emoji);
      const result = await toggleReaction(postId, emoji);
      if (!result.ok) setError(result.message);
    });
  }

  const used = REACTION_EMOJIS.filter((emoji) => (optimistic.counts[emoji] ?? 0) > 0);
  if (used.length === 0 && !canReact) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul aria-label="Réactions" className="flex flex-wrap items-center gap-1.5">
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
                  className={`${PILL} ${PRESS} min-h-9 ${mine ? PILL_MINE : PILL_IDLE} [@media(hover:hover)]:hover:border-accent/50`}
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
              className={`${PILL} ${PRESS} min-h-9 ${PILL_IDLE} text-muted [@media(hover:hover)]:hover:text-foreground`}
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
          className="flex animate-fade-in flex-wrap gap-1 rounded-control border border-line bg-surface p-1"
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

      {error && (
        <p role="alert" className="text-feedback-error">
          {error}
        </p>
      )}
    </div>
  );
}
