import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLICK_WINDOW_MS,
  REACTIONS,
  RESPAWN_MS,
  reaction,
  startPointerReactions,
} from "./halloween-pointer";

describe("reaction", () => {
  const ghost = REACTIONS.ghost;

  it("does nothing when the pointer is out of reach", () => {
    expect(reaction(ghost.radius, 0, ghost)).toEqual({ x: 0, y: 0, amount: 0 });
    expect(reaction(500, 500, ghost)).toEqual({ x: 0, y: 0, amount: 0 });
  });

  it("pushes the drawing away from the pointer, harder the closer it is", () => {
    const near = reaction(20, 0, ghost);
    const far = reaction(120, 0, ghost);
    expect(near.x).toBeGreaterThan(far.x);
    expect(far.x).toBeGreaterThan(0);
    expect(near.y).toBeCloseTo(0);
    expect(near.amount).toBeGreaterThan(far.amount);
    expect(reaction(-20, 0, ghost).x).toBeLessThan(0);
    expect(reaction(0, 30, ghost).y).toBeGreaterThan(0);
  });

  it("never pushes farther than its limit, even right under the pointer", () => {
    const push = Math.hypot(reaction(1, 1, ghost).x, reaction(1, 1, ghost).y);
    expect(push).toBeLessThanOrEqual(ghost.push);
    expect(reaction(0, 0, ghost).amount).toBe(1);
    expect(reaction(0, 0, ghost).y).toBe(-ghost.push);
  });

  it("only makes pumpkins glow, they do not move", () => {
    const result = reaction(30, 0, REACTIONS.pumpkin);
    expect(result.x).toBe(0);
    expect(result.amount).toBeGreaterThan(0);
  });
});

describe("startPointerReactions", () => {
  let root: HTMLDivElement;
  let ghost: HTMLElement;
  let callbacks: FrameRequestCallback[];

  /** Runs the frames asked so far, `count` times over. */
  function flush(count = 1) {
    for (let i = 0; i < count; i += 1) {
      const pending = callbacks;
      callbacks = [];
      for (const callback of pending) callback(0);
    }
  }

  beforeEach(() => {
    callbacks = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    root = document.createElement("div");
    const anchor = document.createElement("div");
    ghost = document.createElement("div");
    ghost.dataset.react = "ghost";
    anchor.append(ghost);
    root.append(anchor);
    document.body.append(root);
    // jsdom has no layout: the ghost sits at (100, 100), 40 px wide.
    anchor.getBoundingClientRect = () =>
      ({ left: 80, top: 80, width: 40, height: 40, right: 120, bottom: 120 }) as DOMRect;
  });

  afterEach(() => {
    root.remove();
    vi.unstubAllGlobals();
  });

  it("moves a ghost away from the pointer, makes it look at it, then lets it settle back", () => {
    const stop = startPointerReactions(root);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 60, clientY: 100 }));
    flush(30);

    // The pointer is on its left: the ghost is pushed to the right and its eyes look to the left.
    expect(ghost.style.transform).toMatch(/translate3d\(([1-9]\d*|0\.\d*[1-9])/);
    expect(Number(ghost.style.getPropertyValue("--react"))).toBeGreaterThan(0.1);
    expect(Number(ghost.style.getPropertyValue("--lx"))).toBeLessThan(0);

    document.documentElement.dispatchEvent(new Event("pointerleave"));
    flush(200);
    expect(ghost.style.transform).toBe("");
    expect(ghost.style.getPropertyValue("--react")).toBe("");
    stop();
  });

  it("makes a ghost say boo on a tap close to it, and stops listening when stopped", () => {
    const stop = startPointerReactions(root);
    window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 110, clientY: 110 }));
    expect(ghost.classList.contains("halloween-boo")).toBe(true);

    ghost.classList.remove("halloween-boo");
    stop();
    window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 110, clientY: 110 }));
    expect(ghost.classList.contains("halloween-boo")).toBe(false);
  });

  it("leaves a ghost alone when the tap is far from it", () => {
    const stop = startPointerReactions(root);
    window.dispatchEvent(new PointerEvent("pointerdown", { clientX: 600, clientY: 600 }));
    expect(ghost.classList.contains("halloween-boo")).toBe(false);
    stop();
  });

  describe("clicking a ghost", () => {
    const click = (x = 100, y = 100) =>
      window.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y }));

    // Only the clock: `flush` drives the animation frames itself.
    beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }));
    afterEach(() => vi.useRealTimers());

    it("swells it a little more at each click, and makes it explode at the third", () => {
      const stop = startPointerReactions(root);
      click();
      click();
      expect(ghost.classList.contains("halloween-exploded")).toBe(false);
      flush(60);
      expect(ghost.style.transform).toMatch(/scale\(1\.[3-9]/); // swollen by two clicks

      click();
      expect(ghost.classList.contains("halloween-exploded")).toBe(true);
      expect(ghost.querySelectorAll(".halloween-spark").length).toBeGreaterThanOrEqual(8);
      expect(ghost.querySelector(".halloween-shock")).not.toBeNull();
      stop();
    });

    it("clears the sparks soon, and brings the ghost back later", () => {
      const stop = startPointerReactions(root);
      click();
      click();
      click();

      vi.advanceTimersByTime(1000);
      expect(ghost.querySelector(".halloween-spark")).toBeNull();
      expect(ghost.classList.contains("halloween-exploded")).toBe(true);

      vi.advanceTimersByTime(RESPAWN_MS);
      expect(ghost.classList.contains("halloween-exploded")).toBe(false);
      stop();
    });

    it("calms down when the clicks are too far apart", () => {
      const stop = startPointerReactions(root);
      click();
      click();
      vi.advanceTimersByTime(CLICK_WINDOW_MS + 100);
      click();
      expect(ghost.classList.contains("halloween-exploded")).toBe(false);
      stop();
    });

    it("ignores clicks on an exploded ghost, and a click beside it does not count", () => {
      const stop = startPointerReactions(root);
      click(400, 400);
      click(400, 400);
      click(400, 400);
      expect(ghost.classList.contains("halloween-exploded")).toBe(false);

      click();
      click();
      click();
      expect(ghost.querySelectorAll(".halloween-shock")).toHaveLength(1);
      click();
      expect(ghost.querySelectorAll(".halloween-shock")).toHaveLength(1);
      stop();
    });

    it("removes the sparks and brings the ghost back when it is stopped", () => {
      const stop = startPointerReactions(root);
      click();
      click();
      click();
      stop();
      expect(ghost.classList.contains("halloween-exploded")).toBe(false);
      expect(ghost.querySelector(".halloween-spark")).toBeNull();
    });
  });

  it("does nothing for people who asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const stop = startPointerReactions(root);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 60, clientY: 100 }));
    flush(5);
    expect(ghost.style.transform).toBe("");
    stop();
  });
});
