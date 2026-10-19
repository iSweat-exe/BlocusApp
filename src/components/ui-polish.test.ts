import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("interface polish", () => {
  it("never animates `all` properties and never presses below 0.96", () => {
    const files = [
      "src/components/app-nav.tsx",
      "src/components/app-header.tsx",
      "src/components/header-icon-link.tsx",
      "src/components/refresh-button.tsx",
      "src/features/announcements/reaction-bar.tsx",
      "src/features/settings/accent-picker.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/transition-all/);
      expect(source, file).not.toMatch(/active:scale-(90|95)\b/);
    }
  });

  it("outlines images with the pure black / white token", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("--image-outline: oklch(0 0 0 / 0.1)");
    expect(css.match(/--image-outline: oklch\(1 0 0 \/ 0\.1\)/g)).toHaveLength(2);
  });
});
