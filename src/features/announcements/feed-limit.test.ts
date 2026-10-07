import { describe, expect, it } from "vitest";
import { FEED_MAX, FEED_STEP, parseFeedLimit } from "./feed-limit";

describe("parseFeedLimit", () => {
  it("defaults to the first page", () => {
    for (const value of [undefined, null, "", "abc", "-5", "1.5", "1e3", "0", ["20"], 20]) {
      expect(parseFeedLimit(value)).toBe(FEED_STEP);
    }
  });

  it("rounds up to a multiple of the step, so only a few distinct values exist", () => {
    expect(parseFeedLimit("10")).toBe(10);
    expect(parseFeedLimit("11")).toBe(20);
    expect(parseFeedLimit("20")).toBe(20);
    expect(parseFeedLimit("41")).toBe(50);
  });

  it("never exceeds the maximum", () => {
    expect(parseFeedLimit("50")).toBe(FEED_MAX);
    expect(parseFeedLimit("999")).toBe(FEED_MAX);
    expect(parseFeedLimit("9999")).toBe(FEED_STEP); // more than 3 digits is not a valid value
  });
});
