import { MAX_ROUTE_POINTS, samePoints, type LngLat } from "@/lib/map-route";

type Snapshot = { points: LngLat[]; selected: number | null };

/** State of the route editor: the line being edited, the selected vertex and the undo / redo history. */
export type EditorState = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
  /** Snapshot taken when a drag started, pushed to the history when it ends with a real move. */
  drag: Snapshot | null;
  /** Route the edit started from, to know whether anything changed. */
  initial: LngLat[];
};

export type EditorAction =
  | { type: "add"; point: LngLat }
  | { type: "moveSelectedTo"; point: LngLat }
  | { type: "removeSelected" }
  | { type: "select"; index: number | null }
  | { type: "dragStart"; index: number }
  | { type: "dragMove"; point: LngLat }
  | { type: "dragEnd" }
  | { type: "reset"; points: readonly LngLat[] }
  | { type: "undo" }
  | { type: "redo" };

/** Longest undo history kept. */
export const HISTORY_LIMIT = 100;

export function initEditor(points: readonly LngLat[]): EditorState {
  return {
    points: points.map((point) => [...point] as LngLat),
    selected: null,
    past: [],
    future: [],
    drag: null,
    initial: points.map((point) => [...point] as LngLat),
  };
}

const snapshot = (state: Snapshot): Snapshot => ({
  points: state.points,
  selected: state.selected,
});

/** Applies a change that is one undo step. */
function commit(state: EditorState, next: Snapshot): EditorState {
  return {
    ...state,
    ...next,
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
    drag: null,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "add": {
      if (state.points.length >= MAX_ROUTE_POINTS) return state;
      // After the selected vertex, else at the end of the line.
      const at = state.selected === null ? state.points.length : state.selected + 1;
      const points = [...state.points.slice(0, at), action.point, ...state.points.slice(at)];
      return commit(state, { points, selected: at });
    }
    case "moveSelectedTo": {
      if (state.selected === null) return state;
      const points = state.points.map((point, i) => (i === state.selected ? action.point : point));
      return commit(state, { points, selected: state.selected });
    }
    case "removeSelected": {
      if (state.selected === null) return state;
      const points = state.points.filter((_, i) => i !== state.selected);
      return commit(state, { points, selected: null });
    }
    case "select":
      return { ...state, selected: action.index };
    case "dragStart":
      return {
        ...state,
        selected: action.index,
        drag: snapshot({ ...state, selected: action.index }),
      };
    case "dragMove": {
      if (!state.drag || state.selected === null) return state;
      return {
        ...state,
        points: state.points.map((point, i) => (i === state.selected ? action.point : point)),
      };
    }
    case "dragEnd": {
      if (!state.drag) return state;
      // A tap without movement selects the point and leaves no history entry.
      if (samePoints(state.drag.points, state.points)) return { ...state, drag: null };
      return {
        ...state,
        past: [...state.past, state.drag].slice(-HISTORY_LIMIT),
        future: [],
        drag: null,
      };
    }
    case "reset":
      return initEditor(action.points);
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
        drag: null,
      };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        ...next,
        past: [...state.past, snapshot(state)],
        future: rest,
        drag: null,
      };
    }
  }
}

/** Whether the line differs from the one the edit started from. */
export function isDirty(state: EditorState): boolean {
  return !samePoints(state.points, state.initial);
}

/** A route can be saved when it is empty (clears it) or has at least two points. */
export function canSave(state: EditorState): boolean {
  return state.points.length === 0 || state.points.length >= 2;
}
