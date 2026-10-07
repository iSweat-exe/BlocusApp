import { describe, expect, it } from "vitest";
import { initialsOf, safeAvatarUrl } from "./avatar";

describe("safeAvatarUrl", () => {
  it("accepts https avatars from allowed hosts", () => {
    expect(safeAvatarUrl("https://cdn.discordapp.com/avatars/1/abc.png")).toBe(
      "https://cdn.discordapp.com/avatars/1/abc.png",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "not a url",
    "http://cdn.discordapp.com/avatars/1/abc.png",
    "https://evil.example/pixel.png",
    "https://cdn.discordapp.com.evil.example/a.png",
    "javascript:alert(1)",
  ])("rejects %j", (value) => {
    expect(safeAvatarUrl(value)).toBeNull();
  });
});

describe("initialsOf", () => {
  it.each([
    ["alice", "AL"],
    ["the_manager", "TM"],
    ["Bob.Smith-Jr", "BS"],
    ["x", "X"],
    ["___", "?"],
  ])("%s -> %s", (pseudo, expected) => {
    expect(initialsOf(pseudo)).toBe(expected);
  });
});
