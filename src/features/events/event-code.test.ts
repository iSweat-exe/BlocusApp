import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_COLORS } from "./event";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Halloween event, kept in step with the rest of the code", () => {
  it("has the same night color in the stylesheet and in the browser bar script", () => {
    expect(read("src/app/halloween.css")).toContain(
      `--halloween-night: ${EVENT_COLORS.halloween};`,
    );
  });

  it("is imported by globals.css and keeps every colour of its rules behind a token", () => {
    expect(read("src/app/globals.css")).toContain('@import "./halloween.css";');
    // Colours are written once, as `--halloween-*` and role tokens (danger, success, warning); rules use `var()`.
    const rules = read("src/app/halloween.css")
      .split("\n")
      .filter((line) => !/^\s*--[a-z-]+:/.test(line) && !/^\s*(\/\*|\*)/.test(line));
    expect(rules.filter((line) => /#[0-9a-f]{3,8}\b/i.test(line))).toEqual([]);
  });

  it("does not couple the event to Tailwind class names: bars and surfaces go through tokens", () => {
    const css = read("src/app/halloween.css");
    expect(css).not.toMatch(/\.bg-(background|surface)/);
    expect(css).toContain("--bar-mix: 100%");
    expect(css).toContain("--color-surface:");
    for (const file of ["src/components/app-header.tsx", "src/components/app-nav.tsx"]) {
      expect(read(file), file).toContain("bg-bar");
    }
  });

  it("loads the decoration on demand only: the layout never imports it directly", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("event-decor");
    expect(layout).not.toMatch(/halloween-(decor|art|pointer)/);
    const gate = read("src/features/events/event-decor.tsx");
    expect(gate).toContain('dynamic(() => import("./halloween-decor")');
    expect(gate).not.toMatch(/^import .*halloween-/m);
  });
});
