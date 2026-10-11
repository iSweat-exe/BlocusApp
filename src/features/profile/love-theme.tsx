import type { ReactNode } from "react";
import { HeartIcon } from "@/components/icons";

/** Hearts that rise behind the header: position, size and rhythm of each, spread so they never move in step. */
const HEARTS = [
  { left: 6, size: 14, delay: 0, duration: 7.5, sway: 14 },
  { left: 17, size: 22, delay: 2.2, duration: 9, sway: -18 },
  { left: 29, size: 12, delay: 4.1, duration: 6.5, sway: 10 },
  { left: 41, size: 18, delay: 1.2, duration: 8.2, sway: -12 },
  { left: 54, size: 26, delay: 3.4, duration: 10, sway: 20 },
  { left: 66, size: 13, delay: 5.6, duration: 7, sway: -10 },
  { left: 77, size: 20, delay: 0.8, duration: 8.8, sway: 16 },
  { left: 88, size: 15, delay: 3.0, duration: 6.8, sway: -14 },
  { left: 94, size: 24, delay: 5.0, duration: 9.5, sway: 12 },
] as const;

/**
 * Decoration only: hearts floating up behind the page. Hidden from assistive technologies and from clicks. It
 * sits at a negative z-index, so its parent must create a stacking context (`isolate`).
 */
export function LoveHearts() {
  return (
    <div
      aria-hidden="true"
      data-testid="love-hearts"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden"
    >
      {HEARTS.map((heart) => (
        <span
          key={heart.left}
          className="love-heart text-accent"
          style={{
            left: `${heart.left}%`,
            width: heart.size,
            height: heart.size,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
            ["--sway" as string]: `${heart.sway}px`,
          }}
        >
          <HeartIcon className="size-full" fill="currentColor" strokeWidth="1" />
        </span>
      ))}
    </div>
  );
}

/** A beating gradient frame around the avatar. */
export function LoveRing({ children }: { children: ReactNode }) {
  return <div className="love-ring">{children}</div>;
}
