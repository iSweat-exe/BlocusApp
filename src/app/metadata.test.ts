import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src/app");

/** Every `page.tsx` under `src/app`. */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === "page.tsx" ? [path] : [];
  });
}

describe("page titles", () => {
  it("gives every page its own title, so the tab says where the person is", () => {
    const missing = pages(APP)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          !/export const metadata[^=]*=\s*\{\s*title:/.test(source) &&
          !source.includes("generateMetadata")
        );
      })
      .map((path) => relative(APP, path));
    expect(missing).toEqual([]);
  });

  it("brands them with one template in the root layout, not page by page", () => {
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(layout).toContain('template: "%s · BLOCUS"');
    for (const path of pages(APP)) {
      expect(readFileSync(path, "utf8"), relative(APP, path)).not.toMatch(/title: "[^"]*· BLOCUS"/);
    }
  });
});
