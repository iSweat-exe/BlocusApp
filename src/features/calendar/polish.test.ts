import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(join(process.cwd(), "src/features/calendar", file), "utf8");
const FILES = ["month-view.tsx", "view-switcher.tsx", "imminent-banner.tsx", "event-detail.tsx"];

describe("calendar interface polish", () => {
  it("only hovers where a pointer can hover (no sticky hover on touch screens)", () => {
    for (const file of FILES) {
      const source = read(file);
      // Take away the guarded ones: no `hover:` utility is left.
      const bare =
        source.replaceAll("[@media(hover:hover)]:hover:", "").match(/(?<![\w-])hover:/g) ?? [];
      expect(bare, file).toEqual([]);
    }
  });

  it("never animates all properties, presses at 0.96 and uses only animations the project defines", () => {
    for (const file of FILES) {
      const source = read(file);
      expect(source, file).not.toMatch(/transition-all/);
      expect(source, file).not.toMatch(/active:scale-(90|95)\b/);
      expect(source, file).not.toMatch(/animate-in|zoom-in-95|fade-in duration/);
    }
  });

  it("keeps the nested corners concentric", () => {
    const week = read("month-view.tsx");
    // Week bar (12 px) holds blocks inset by 2 px: 10 px. Day timeline (12 px) inset by 8 px: 4 px.
    expect(week).toContain("rounded-[calc(var(--radius-control)-0.125rem)]");
    expect(week).toContain("rounded-[calc(var(--radius-control)-0.5rem)]");
    // The view menu (12 px) holds items with 4 px of padding: 8 px.
    expect(read("view-switcher.tsx")).toMatch(/min-h-tap[^"]*rounded-lg/);
  });
});
