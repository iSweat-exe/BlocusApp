import { describe, expect, it } from "vitest";
import { isRateLimited, RATE_LIMITED_MESSAGE } from "./rate-limit";

describe("isRateLimited", () => {
  it("recognizes the database refusal", () => {
    expect(isRateLimited({ message: "rate_limited" })).toBe(true);
  });

  it("ignores every other error", () => {
    expect(isRateLimited({ message: "forbidden" })).toBe(false);
    expect(isRateLimited({ message: "rate_limited_somewhere" })).toBe(false);
    expect(isRateLimited({ message: "" })).toBe(false);
  });

  it("has a message for the user", () => {
    expect(RATE_LIMITED_MESSAGE.length).toBeGreaterThan(0);
  });
});
