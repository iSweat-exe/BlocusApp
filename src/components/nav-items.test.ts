import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActivePath } from "./nav-items";

describe("isActivePath", () => {
  it("matches the home only on `/`", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/calendar", "/")).toBe(false);
  });

  it("matches a section and its nested routes, not a look-alike prefix", () => {
    expect(isActivePath("/calendar", "/calendar")).toBe(true);
    expect(isActivePath("/calendar/abc", "/calendar")).toBe(true);
    expect(isActivePath("/calendar-old", "/calendar")).toBe(false);
  });

  it("lists the four sections", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/", "/calendar", "/map", "/settings"]);
  });
});
