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
  it("makes Syne the first font of the app, with Geist Sans as the fallback", () => {
    expect(declared("--font-sans")).toBe(
      "var(--font-syne-face), var(--font-geist-sans), sans-serif",
    );
  });

  it("applies --font-sans once on the body (no second, redundant Syne declaration)", () => {
    const body = /\nbody\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(body).toContain("font-family: var(--font-sans), Arial, Helvetica, sans-serif;");
    expect(body).not.toContain("--font-syne");
  });

  it("loads Syne in the root layout with the variable that --font-sans points at", () => {
    expect(layout).toMatch(/Syne\(\{[^}]*variable: "--font-syne-face"/);
  });

  it("does not preload the fallback font", () => {
    expect(layout).toMatch(/Geist\(\{[^}]*preload: false/);
  });
});
