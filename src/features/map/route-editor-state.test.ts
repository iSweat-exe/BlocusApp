import { describe, expect, it } from "vitest";
import type { LngLat } from "@/lib/map-route";
import { MAX_ROUTE_POINTS } from "@/lib/map-route";
import {
  canSave,
  editorReducer,
  HISTORY_LIMIT,
  initEditor,
  isDirty,
  type EditorAction,
} from "./route-editor-state";

const run = (actions: EditorAction[], start: LngLat[] = []) =>
  actions.reduce(editorReducer, initEditor(start));

describe("route editor", () => {
  it("appends points at the end, selecting the new one", () => {
    const state = run([
      { type: "add", point: [1, 1] },
      { type: "add", point: [2, 2] },
    ]);
    expect(state.points).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(state.selected).toBe(1);
  });

  it("inserts after the selected point", () => {
    const state = run(
      [
        { type: "select", index: 0 },
        { type: "add", point: [9, 9] },
      ],
      [
        [1, 1],
        [2, 2],
      ],
    );
    expect(state.points).toEqual([
      [1, 1],
      [9, 9],
      [2, 2],
    ]);
    expect(state.selected).toBe(1);
  });

  it("moves and removes the selected point", () => {
    const start: LngLat[] = [
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    const moved = run(
      [
        { type: "select", index: 1 },
        { type: "moveSelectedTo", point: [5, 5] },
      ],
      start,
    );
    expect(moved.points[1]).toEqual([5, 5]);
    const removed = editorReducer(moved, { type: "removeSelected" });
    expect(removed.points).toEqual([
      [1, 1],
      [3, 3],
    ]);
    expect(removed.selected).toBeNull();
    // Nothing selected: nothing happens.
    expect(editorReducer(removed, { type: "removeSelected" })).toBe(removed);
    expect(editorReducer(removed, { type: "moveSelectedTo", point: [0, 0] })).toBe(removed);
  });

  it("undoes and redoes, and a new change drops the redo history", () => {
    let state = run([
      { type: "add", point: [1, 1] },
      { type: "add", point: [2, 2] },
    ]);
    state = editorReducer(state, { type: "undo" });
    expect(state.points).toEqual([[1, 1]]);
    state = editorReducer(state, { type: "redo" });
    expect(state.points).toHaveLength(2);
    state = editorReducer(state, { type: "undo" });
    state = editorReducer(state, { type: "add", point: [7, 7] });
    expect(state.future).toEqual([]);
    expect(editorReducer(state, { type: "redo" })).toBe(state);
    expect(editorReducer(initEditor([]), { type: "undo" }).points).toEqual([]);
  });

  it("makes a whole drag one undo step, and a plain tap none", () => {
    const start: LngLat[] = [
      [1, 1],
      [2, 2],
    ];
    let state = run(
      [
        { type: "dragStart", index: 1 },
        { type: "dragMove", point: [2.1, 2.1] },
        { type: "dragMove", point: [2.2, 2.2] },
        { type: "dragEnd" },
      ],
      start,
    );
    expect(state.points[1]).toEqual([2.2, 2.2]);
    expect(state.past).toHaveLength(1);
    state = editorReducer(state, { type: "undo" });
    expect(state.points[1]).toEqual([2, 2]);

    const tap = run([{ type: "dragStart", index: 0 }, { type: "dragEnd" }], start);
    expect(tap.selected).toBe(0);
    expect(tap.past).toHaveLength(0);
  });

  it("starts over from a given route", () => {
    const state = run([
      { type: "add", point: [9, 9] },
      { type: "reset", points: [[1, 1]] },
    ]);
    expect(state.points).toEqual([[1, 1]]);
    expect(state.past).toHaveLength(0);
    expect(isDirty(state)).toBe(false);
  });

  it("ignores drag moves without a drag in progress", () => {
    const state = initEditor([[1, 1]]);
    expect(editorReducer(state, { type: "dragMove", point: [9, 9] })).toBe(state);
  });

  it("caps the number of points and the history", () => {
    const full = initEditor(Array.from({ length: MAX_ROUTE_POINTS }, () => [1, 1] as LngLat));
    expect(editorReducer(full, { type: "add", point: [2, 2] })).toBe(full);

    let state = initEditor([[1, 1]]);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      state = editorReducer(state, { type: "select", index: 0 });
      state = editorReducer(state, { type: "moveSelectedTo", point: [i, 1] });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it("knows when the route changed and when it can be saved", () => {
    const start: LngLat[] = [
      [1, 1],
      [2, 2],
    ];
    const state = initEditor(start);
    expect(isDirty(state)).toBe(false);
    expect(canSave(state)).toBe(true);
    const edited = run([{ type: "select", index: 1 }, { type: "removeSelected" }], start);
    expect(isDirty(edited)).toBe(true);
    expect(canSave(edited)).toBe(false); // one point left
    expect(canSave(run([], []))).toBe(true); // empty clears the route
  });
});
