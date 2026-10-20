"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  CandyCorn,
  Cobweb,
  Ghost,
  GHOST_TINTS,
  Pumpkin,
  Sparkle,
  Spider,
  WrappedCandy,
  type CandyTone,
  type GhostTint,
} from "./halloween-art";
import { startPointerReactions } from "./halloween-pointer";

/**
 * Things crossing the screen. `top`: vertical position (%), `cross`: crossing time (s), `offset`: start offset
 * (s, negative so they are already on their way when the page opens), `back`: flies right to left. Ghosts also
 * zigzag: `zig` is how far they swing up and down (px) and `zigTime` how long one swing takes (s), so the path is
 * made of straight diagonal legs. The sizes and opacities differ on purpose: the big, bright ones feel close, the
 * small, pale ones far away. Few of them on purpose: the page has to stay easy to read.
 */
const GHOSTS: readonly {
  size: number;
  top: number;
  cross: number;
  offset: number;
  opacity: number;
  bob: number;
  back: boolean;
  tint: GhostTint;
  zig: number;
  zigTime: number;
}[] = [
  {
    size: 72,
    top: 24,
    cross: 50,
    offset: -8,
    opacity: 0.92,
    bob: 3.6,
    back: false,
    tint: "violet",
    zig: 70,
    zigTime: 2.6,
  },
  {
    size: 40,
    top: 52,
    cross: 40,
    offset: -26,
    opacity: 0.6,
    bob: 3,
    back: true,
    tint: "mint",
    zig: 50,
    zigTime: 2.1,
  },
  {
    size: 84,
    top: 70,
    cross: 62,
    offset: -41,
    opacity: 0.9,
    bob: 4.4,
    back: false,
    tint: "peach",
    zig: 80,
    zigTime: 3.2,
  },
  {
    size: 54,
    top: 36,
    cross: 56,
    offset: -33,
    opacity: 0.75,
    bob: 3.9,
    back: true,
    tint: "violet",
    zig: 60,
    zigTime: 2.8,
  },
];

const PUMPKINS = [{ size: 54, top: 74, cross: 90, offset: -30, back: false }] as const;

type CandyKind = { type: "wrapped"; tone: CandyTone } | { type: "corn" };

/** Sweets falling: `left` (%), `fall` time (s), `offset` start offset (s), `sway` sideways drift (px). */
const CANDIES: readonly {
  candy: CandyKind;
  size: number;
  left: number;
  fall: number;
  offset: number;
  sway: number;
}[] = [
  { candy: { type: "wrapped", tone: "orange" }, size: 32, left: 8, fall: 19, offset: -3, sway: 24 },
  { candy: { type: "corn" }, size: 26, left: 24, fall: 23, offset: -13, sway: -30 },
  {
    candy: { type: "wrapped", tone: "purple" },
    size: 34,
    left: 41,
    fall: 17,
    offset: -8,
    sway: -22,
  },
  { candy: { type: "corn" }, size: 28, left: 58, fall: 21, offset: -1, sway: -28 },
  { candy: { type: "wrapped", tone: "pink" }, size: 28, left: 75, fall: 18, offset: -10, sway: 22 },
  {
    candy: { type: "wrapped", tone: "green" },
    size: 30,
    left: 91,
    fall: 24,
    offset: -17,
    sway: -20,
  },
];

/** Twinkling stars: position (%), size (px), twinkle time (s) and offset (s). */
const SPARKLES = [
  { left: 12, top: 18, size: 12, time: 3.2, offset: 0 },
  { left: 47, top: 22, size: 14, time: 3.8, offset: -2.1 },
  { left: 82, top: 24, size: 12, time: 3.4, offset: -1.8 },
  { left: 8, top: 55, size: 9, time: 3.1, offset: -0.9 },
  { left: 38, top: 88, size: 11, time: 3.6, offset: -2.7 },
  { left: 95, top: 60, size: 12, time: 3.3, offset: -0.3 },
] as const;

function Candy({ candy }: { candy: CandyKind }) {
  if (candy.type === "corn") return <CandyCorn />;
  return <WrappedCandy tone={candy.tone} />;
}

/** Something that crosses the screen: the wrapper carries the crossing, `children` the drawing and its reaction. */
function Crossing({
  top,
  cross,
  offset,
  back,
  zig,
  zigTime = 2.5,
  children,
}: {
  top: number;
  cross: number;
  offset: number;
  back: boolean;
  /** Swing up and down (px); none means a straight crossing. */
  zig?: number;
  zigTime?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={`halloween-moving halloween-cross absolute left-0 ${back ? "halloween-back" : ""}`}
      style={{ top: `${top}%`, animationDuration: `${cross}s`, animationDelay: `${offset}s` }}
    >
      {zig === undefined ? (
        children
      ) : (
        // The zigzag layer is the anchor the pointer reactions measure: the ghost is where it zigzags to.
        <div
          className="halloween-zig"
          style={
            { ["--zig" as string]: `${zig}px`, animationDuration: `${zigTime}s` } as CSSProperties
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Halloween decoration of the whole app: ghosts (zigzagging) and a lit pumpkin crossing the screen, a few sweets falling, stars
 * twinkling, a cobweb with its spider in the corner. Purely decorative (hidden from assistive technologies, never
 * catches a tap). The drawings react to the cursor (see `halloween-pointer.ts`); only transforms and opacity move,
 * and everything that moves disappears when the person asked for reduced motion. It sits **behind** the page (`-z-10`, over the
 * background only) and is kept faint (`opacity-40`): the text, the cards and the bars are drawn over it, so it never
 * gets in the way of reading. Only the cobweb and its spider, in the top-left corner, are in front (the
 * sidebar and the header would hide them otherwise). Mounted by `EventDecor` only while the event runs, and loaded only then.
 */
export function HalloweenDecor() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return startPointerReactions(root);
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        aria-hidden="true"
        data-testid="halloween-decor"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-40"
      >
        {SPARKLES.map((sparkle) => (
          <div
            key={`${sparkle.left}-${sparkle.top}`}
            className="halloween-moving halloween-twinkle absolute"
            style={{
              left: `${sparkle.left}%`,
              top: `${sparkle.top}%`,
              width: sparkle.size,
              height: sparkle.size,
              animationDuration: `${sparkle.time}s`,
              animationDelay: `${sparkle.offset}s`,
            }}
          >
            <Sparkle />
          </div>
        ))}

        {PUMPKINS.map((pumpkin) => (
          <Crossing key={pumpkin.top} {...pumpkin}>
            <div data-react="pumpkin" className="halloween-react">
              <div
                className="halloween-bob halloween-pumpkin"
                style={{
                  width: pumpkin.size,
                  height: pumpkin.size * 0.94,
                  animationDuration: "4.6s",
                }}
              >
                <Pumpkin />
              </div>
            </div>
          </Crossing>
        ))}

        {GHOSTS.map((ghost) => (
          <Crossing key={ghost.top} {...ghost}>
            <div
              data-react="ghost"
              className="halloween-react halloween-ghost"
              style={{ ["--glow" as string]: GHOST_TINTS[ghost.tint].glow } as CSSProperties}
            >
              <div
                className="halloween-bob"
                style={{
                  width: ghost.size * 0.9,
                  height: ghost.size,
                  opacity: ghost.opacity,
                  animationDuration: `${ghost.bob}s`,
                }}
              >
                <Ghost tint={ghost.tint} />
              </div>
            </div>
          </Crossing>
        ))}

        {CANDIES.map((candy, index) => (
          <div
            key={candy.left}
            className="halloween-moving halloween-fall absolute top-0"
            style={
              {
                left: `${candy.left}%`,
                animationDuration: `${candy.fall}s`,
                animationDelay: `${candy.offset}s`,
                ["--sway" as string]: `${candy.sway}px`,
                ["--spin" as string]: index % 2 === 0 ? "360deg" : "-360deg",
              } as CSSProperties
            }
          >
            <div
              data-react="candy"
              className="halloween-react halloween-candy"
              style={{
                width: candy.size,
                height: candy.size,
              }}
            >
              <Candy candy={candy.candy} />
            </div>
          </div>
        ))}
      </div>
      {/* The corner is the one piece in front of the page and its bars (the sidebar hides everything behind it):
          thin lines and a small spider, in a corner where they hide nothing that matters. */}
      <div
        aria-hidden="true"
        data-testid="halloween-corner"
        className="pointer-events-none fixed top-0 left-0 z-40"
      >
        <Cobweb />
        <div className="halloween-moving halloween-swing absolute top-0 left-6 h-16 w-9 lg:left-9 lg:h-20 lg:w-11">
          <Spider />
        </div>
      </div>
    </>
  );
}
