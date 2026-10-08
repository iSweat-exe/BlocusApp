import { afterEach, describe, expect, it } from "vitest";
import { ACCENT_PRESETS, ACCENT_STORAGE_KEY, accentVars, normalizeHex } from "./accent";
import { ACCENT_BOOT_SCRIPT } from "./accent-script";

describe("normalizeHex", () => {
  it("accepts #rrggbb, rrggbb and #rgb in any case", () => {
    expect(normalizeHex("#FF3B46")).toBe("#ff3b46");
    expect(normalizeHex("ff3b46")).toBe("#ff3b46");
    expect(normalizeHex(" #f0a ")).toBe("#ff00aa");
  });

  it("rejects anything that is not a color (it ends up in a CSS variable)", () => {
    for (const bad of [
      "",
      null,
      undefined,
      "red",
      "#12",
      "#12345",
      "#gggggg",
      "#fff;x:y",
      "url(x)",
    ]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("accentVars", () => {
  it("darkens the pressed color and picks a readable ink", () => {
    expect(accentVars("#ff0000")).toEqual({ accent: "#ff0000", strong: "#d90000", ink: "#ffffff" });
    expect(accentVars("#ffff00").ink).toBe("#111111");
  });
});

describe("ACCENT_BOOT_SCRIPT", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("applies exactly what accentVars computes, for every preset", () => {
    for (const { hex } of ACCENT_PRESETS) {
      localStorage.setItem(ACCENT_STORAGE_KEY, hex);
      new Function(ACCENT_BOOT_SCRIPT)();
      const style = document.documentElement.style;
      const expected = accentVars(hex);
      expect(style.getPropertyValue("--accent")).toBe(expected.accent);
      expect(style.getPropertyValue("--accent-strong")).toBe(expected.strong);
      expect(style.getPropertyValue("--accent-ink")).toBe(expected.ink);
    }
  });

  it("does nothing without a valid saved color", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, "javascript:alert(1)");
    new Function(ACCENT_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute("style")).toBeNull();
  });
});
