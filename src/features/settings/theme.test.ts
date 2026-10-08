import { afterEach, describe, expect, it } from "vitest";
import { normalizeTheme, THEME_COLORS, THEME_STORAGE_KEY } from "./theme";
import { THEME_BOOT_SCRIPT } from "./theme-script";

describe("normalizeTheme", () => {
  it("keeps the three valid values and falls back to system for anything else", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
    for (const bad of [null, undefined, "", "Dark", "blue", "<script>"]) {
      expect(normalizeTheme(bad)).toBe("system");
    }
  });
});

describe("THEME_BOOT_SCRIPT", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.head.innerHTML = "";
  });

  it("forces the saved theme and aligns the browser bar color once parsed", () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">' +
      '<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">';
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    for (const meta of document.querySelectorAll("meta[name=theme-color]")) {
      expect(meta.getAttribute("content")).toBe(THEME_COLORS.dark);
      expect(meta.hasAttribute("media")).toBe(false);
    }
  });

  it("leaves the page alone for system or an invalid value", () => {
    new Function(THEME_BOOT_SCRIPT)();
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
