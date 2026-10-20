/**
 * How the Halloween decoration reacts to the cursor (or a finger). The drawings never catch a pointer event (a
 * ghost over a button must not steal the tap), so one listener on the window follows the pointer and moves the
 * drawings itself: ghosts drift away and look at it, sweets are pushed like bubbles, pumpkins glow. A click or tap on
 * a ghost makes it swell; a few quick ones make it explode, and it comes back a little later. A tap on a sweet makes
 * it spin.
 */

export type ReactKind = "ghost" | "candy" | "pumpkin";

type Spec = {
  /** Distance (px) at which the pointer starts to matter. */
  radius: number;
  /** Farthest the drawing is pushed away (px). */
  push: number;
  /** Extra scale at the closest point (0.2 = 20 % bigger). */
  grow: number;
};

export const REACTIONS: Record<ReactKind, Spec> = {
  ghost: { radius: 180, push: 56, grow: 0.16 },
  candy: { radius: 120, push: 34, grow: 0.28 },
  pumpkin: { radius: 170, push: 0, grow: 0.16 },
};

/** Extra reach (px) around a ghost's own size within which a click counts as a click on it. */
const GHOST_HIT_MARGIN = 14;
/** Distance (px) of a tap within which a sweet answers it. */
const CANDY_TAP_RADIUS = 56;
/** Clicks on the same ghost that make it explode… */
export const CLICKS_TO_EXPLODE = 3;
/** …when each comes within this time (ms) of the previous one; otherwise it calms down. */
export const CLICK_WINDOW_MS = 3500;
/** Time (ms) before an exploded ghost comes back. */
export const RESPAWN_MS = 7000;
/** Sparks thrown by an explosion, and how long they live (ms). */
const SPARKS = 14;
const SPARK_LIFE_MS = 900;
/** Extra scale of a ghost for each click it took (it swells before it pops). */
const SWELL_PER_CLICK = 0.2;
/** Share of the remaining distance covered each frame: a soft ease instead of a jump. */
const EASE = 0.16;

/**
 * What the pointer does to a drawing.
 * @param dx - Drawing center minus pointer, horizontally (px).
 * @param dy - Drawing center minus pointer, vertically (px).
 * @returns `x` and `y` push (px) and `amount`, 0 (far) to 1 (on top of it), eased so it fades smoothly.
 */
export function reaction(
  dx: number,
  dy: number,
  spec: Spec,
): { x: number; y: number; amount: number } {
  const distance = Math.hypot(dx, dy);
  if (distance >= spec.radius) return { x: 0, y: 0, amount: 0 };
  const t = 1 - distance / spec.radius;
  const amount = t * t * (3 - 2 * t); // smoothstep
  if (distance === 0) return { x: 0, y: -spec.push * amount, amount };
  return {
    x: (dx / distance) * spec.push * amount,
    y: (dy / distance) * spec.push * amount,
    amount,
  };
}

type Item = {
  el: HTMLElement;
  anchor: Element;
  kind: ReactKind;
  x: number;
  y: number;
  amount: number;
  /** Eased extra scale from the clicks a ghost took. */
  swell: number;
  clicks: number;
  lastClick: number;
  exploded: boolean;
};

/**
 * Starts the reactions of every `[data-react]` drawing under `root`. Each one is wrapped in an element that carries
 * the CSS animation (its `anchor`): the position is read from the anchor, so the push applied to the drawing itself
 * never feeds back into the measure. Nothing runs unless the pointer is on the page (or a finger is down), and
 * nothing runs at all for people who asked for reduced motion.
 * @returns A function that stops everything and removes the listeners and the sparks.
 */
export function startPointerReactions(root: HTMLElement): () => void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  const items: Item[] = Array.from(root.querySelectorAll<HTMLElement>("[data-react]")).flatMap(
    (el) => {
      const kind = el.dataset.react as ReactKind | undefined;
      const anchor = el.parentElement;
      return kind && kind in REACTIONS && anchor
        ? [
            {
              el,
              anchor,
              kind,
              x: 0,
              y: 0,
              amount: 0,
              swell: 0,
              clicks: 0,
              lastClick: 0,
              exploded: false,
            },
          ]
        : [];
    },
  );

  const pointer = { x: 0, y: 0, active: false };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let frame = 0;

  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const tick = () => {
    frame = 0;
    let moving = false;
    const now = Date.now();
    for (const item of items) {
      const spec = REACTIONS[item.kind];
      const box = item.anchor.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      if (item.clicks > 0 && now - item.lastClick > CLICK_WINDOW_MS) item.clicks = 0;
      const target =
        pointer.active && !item.exploded
          ? reaction(cx - pointer.x, cy - pointer.y, spec)
          : { x: 0, y: 0, amount: 0 };

      item.x += (target.x - item.x) * EASE;
      item.y += (target.y - item.y) * EASE;
      item.amount += (target.amount - item.amount) * EASE;
      item.swell += (item.clicks * SWELL_PER_CLICK - item.swell) * EASE;
      const settled =
        Math.abs(item.x) < 0.05 &&
        Math.abs(item.y) < 0.05 &&
        item.amount < 0.005 &&
        Math.abs(item.swell) < 0.005;
      if (settled && !pointer.active) {
        item.x = item.y = item.amount = item.swell = 0;
        item.el.style.removeProperty("transform");
        item.el.style.removeProperty("--react");
        item.el.style.removeProperty("--lx");
        item.el.style.removeProperty("--ly");
        continue;
      }
      moving = true;
      const scale = 1 + item.amount * spec.grow + item.swell;
      item.el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      item.el.style.setProperty("--react", item.amount.toFixed(3));
      if (item.kind === "ghost") {
        // The eyes look at the pointer, wherever it is (at most 2.4 px off center in the drawing).
        const lx = pointer.x - cx;
        const ly = pointer.y - cy;
        const length = Math.hypot(lx, ly) || 1;
        item.el.style.setProperty("--lx", ((lx / length) * 2.4).toFixed(2));
        item.el.style.setProperty("--ly", ((ly / length) * 2.4).toFixed(2));
      }
    }
    if (moving || pointer.active) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  /** Throws sparks out of a ghost and hides it until it comes back. */
  const explode = (item: Item) => {
    item.exploded = true;
    item.clicks = 0;
    item.el.classList.add("halloween-exploded");
    const sparks: HTMLElement[] = [];
    for (let i = 0; i < SPARKS; i += 1) {
      const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 50 + Math.random() * 70;
      const spark = document.createElement("span");
      spark.className = `halloween-spark ${i % 3 === 0 ? "halloween-spark-ember" : ""}`;
      spark.style.setProperty("--dx", `${(Math.cos(angle) * distance).toFixed(0)}px`);
      spark.style.setProperty("--dy", `${(Math.sin(angle) * distance).toFixed(0)}px`);
      spark.style.setProperty("--size", `${(4 + Math.random() * 6).toFixed(1)}px`);
      item.el.append(spark);
      sparks.push(spark);
    }
    const shock = document.createElement("span");
    shock.className = "halloween-shock";
    item.el.append(shock);
    sparks.push(shock);
    later(() => sparks.forEach((spark) => spark.remove()), SPARK_LIFE_MS);
    later(() => {
      item.exploded = false;
      item.el.classList.remove("halloween-exploded");
    }, RESPAWN_MS);
  };

  const onMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    wake();
  };
  const onDown = (event: PointerEvent) => {
    onMove(event);
    const now = Date.now();
    for (const item of items) {
      if (item.kind !== "ghost" && item.kind !== "candy") continue;
      if (item.exploded) continue;
      const box = item.anchor.getBoundingClientRect();
      const distance = Math.hypot(
        box.left + box.width / 2 - event.clientX,
        box.top + box.height / 2 - event.clientY,
      );
      const reach =
        item.kind === "ghost"
          ? Math.max(box.width, box.height) / 2 + GHOST_HIT_MARGIN
          : CANDY_TAP_RADIUS;
      if (distance > reach) continue;

      const cls = item.kind === "ghost" ? "halloween-boo" : "halloween-pop";
      item.el.classList.remove(cls);
      void item.el.offsetWidth; // restart the animation if it is already playing
      item.el.classList.add(cls);

      if (item.kind === "ghost") {
        item.clicks = now - item.lastClick > CLICK_WINDOW_MS ? 1 : item.clicks + 1;
        item.lastClick = now;
        if (item.clicks >= CLICKS_TO_EXPLODE) explode(item);
      }
    }
  };
  const onUp = (event: PointerEvent) => {
    // A finger leaves the screen: nothing to follow any more. A mouse stays on the page.
    if (event.pointerType === "touch") {
      pointer.active = false;
      wake();
    }
  };
  const onLeave = () => {
    pointer.active = false;
    wake();
  };
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === "halloween-boo")
      (event.target as HTMLElement).classList.remove("halloween-boo");
    if (event.animationName === "halloween-pop")
      (event.target as HTMLElement).classList.remove("halloween-pop");
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  root.addEventListener("animationend", onAnimationEnd);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const item of items) {
      item.el.classList.remove("halloween-exploded");
      item.el
        .querySelectorAll(".halloween-spark, .halloween-shock")
        .forEach((node) => node.remove());
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("animationend", onAnimationEnd);
  };
}
