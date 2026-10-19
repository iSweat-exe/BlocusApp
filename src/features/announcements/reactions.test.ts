import { describe, expect, it } from "vitest";
import {
  buildReactionState,
  groupReactors,
  isReactionEmoji,
  isReactionKind,
  REACTION_EMOJIS,
  toggleReactionState,
} from "./reactions";

describe("isReactionEmoji", () => {
  it("accepts the palette and nothing else", () => {
    for (const emoji of REACTION_EMOJIS) expect(isReactionEmoji(emoji)).toBe(true);
    expect(isReactionEmoji("🤡")).toBe(false);
    expect(isReactionEmoji("👍👍")).toBe(false);
    expect(isReactionEmoji(undefined)).toBe(false);
  });
});

describe("buildReactionState", () => {
  it("keeps the shared totals and flags the viewer's own emojis", () => {
    expect(buildReactionState({ "👍": 3, "🔥": 1 }, ["🔥"])).toEqual({
      counts: { "👍": 3, "🔥": 1 },
      mine: ["🔥"],
    });
  });

  it("never shows a highlighted emoji with a total of zero (stale cache)", () => {
    expect(buildReactionState({}, ["🎉"])).toEqual({ counts: { "🎉": 1 }, mine: ["🎉"] });
  });

  it("ignores emojis outside the palette", () => {
    expect(buildReactionState({ "🤡": 9 }, ["🤡"])).toEqual({ counts: {}, mine: [] });
  });
});

describe("toggleReactionState", () => {
  it("adds the viewer's reaction", () => {
    expect(toggleReactionState({ counts: { "👍": 2 }, mine: [] }, "👍")).toEqual({
      counts: { "👍": 3 },
      mine: ["👍"],
    });
  });

  it("removes it, and drops an emoji nobody uses any more", () => {
    expect(toggleReactionState({ counts: { "👍": 1 }, mine: ["👍"] }, "👍")).toEqual({
      counts: {},
      mine: [],
    });
  });
});

describe("groupReactors and isReactionKind", () => {
  it("groups pseudos by emoji in palette order and drops anything else", () => {
    expect(
      groupReactors([
        { emoji: "🔥", pseudo: "carla" },
        { emoji: "👍", pseudo: "alice" },
        { emoji: "🤡", pseudo: "ghost" },
        { emoji: "👍", pseudo: "bob" },
      ]),
    ).toEqual({ "👍": ["alice", "bob"], "🔥": ["carla"] });
  });

  it("knows the two kinds of target", () => {
    expect(isReactionKind("post")).toBe(true);
    expect(isReactionKind("event")).toBe(true);
    expect(isReactionKind("comment")).toBe(false);
    expect(isReactionKind(undefined)).toBe(false);
  });
});
