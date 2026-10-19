import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");

/** Value of a CSS custom property declared in `globals.css` (first declaration). */
function declared(name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

describe("typography", () => {
  it("uses Inter for the text and Archivo for the display, each with a text fallback", () => {
    expect(declared("--font-sans")).toBe("var(--font-inter-face), system-ui, sans-serif");
    expect(declared("--font-display")).toBe(
      "var(--font-archivo-face), var(--font-inter-face), system-ui, sans-serif",
    );
  });

  it("applies --font-sans once on the body", () => {
    const body = /\nbody\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(body).toContain("font-family: var(--font-sans), Arial, Helvetica, sans-serif;");
    expect(body).not.toContain("--font-display");
  });

  it("sets headings in the display font, and keeps the small section labels in the text font", () => {
    const base = /@layer base\s*\{[^@]*\n\}/.exec(css)?.[0] ?? "";
    expect(base).toMatch(/h1,\s*h2,\s*h3\s*\{\s*font-family: var\(--font-display\);/);
    expect(/\.section-title\s*\{[^}]*\bfont-sans\b/.test(css)).toBe(true);
  });

  it("loads both fonts in the root layout, with the variables the tokens point at", () => {
    expect(layout).toMatch(/Inter\(\{[^}]*variable: "--font-inter-face"/);
    expect(layout).toMatch(/Archivo\(\{[^}]*variable: "--font-archivo-face"/);
  });

  it("does not load the fonts it replaced, and still lazy-loads the monospace one", () => {
    expect(layout).not.toMatch(/Syne|Geist\(/);
    expect(layout).toMatch(/Geist_Mono\(\{[^}]*preload: false/);
  });
});

describe("short labels", () => {
  it("never breaks a chip over two lines", () => {
    const chip = /\.chip\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(chip).toContain("whitespace-nowrap");
  });
});

describe("focus", () => {
  it("never outlines the targets marked as focus-silent, with a rule that beats the global focus ring", () => {
    expect(css).toMatch(/\[data-focus-silent\]:focus-visible\s*\{\s*outline: none;/);
    // Unlayered, like the global ring, and declared after it.
    const ring = css.search(/^:focus-visible \{/m);
    expect(css.indexOf("[data-focus-silent]:focus-visible")).toBeGreaterThan(ring);
  });
});
