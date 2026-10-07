import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirectPath("/map?x=1")).toBe("/map?x=1");
  });

  it.each([null, undefined, "", "map", "https://evil.com", "//evil.com", "/\\evil.com", "/a\nb"])(
    "falls back to / for %j",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/");
    },
  );
});
