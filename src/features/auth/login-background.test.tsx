import { render } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LOGIN_BACKGROUNDS, LoginBackground } from "./login-background";

describe("LoginBackground", () => {
  it("renders nothing of the photo on the server: /login stays static and no wrong image can flash", () => {
    const html = renderToString(<LoginBackground />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("login-bg");
    expect(html).not.toContain("url(");
  });

  it("shows exactly one of the photos on the client, decorative and faded into the page", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { container } = render(<LoginBackground />);
    const photos = container.querySelectorAll(".login-bg");
    expect(photos).toHaveLength(1);
    expect(photos[0]?.getAttribute("style")).toContain(LOGIN_BACKGROUNDS[2]);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toBeNull();
    vi.restoreAllMocks();
  });

  it("only points at files that exist in public/", () => {
    expect(LOGIN_BACKGROUNDS.length).toBeGreaterThan(0);
    for (const path of LOGIN_BACKGROUNDS) {
      expect(existsSync(join(process.cwd(), "public", path)), path).toBe(true);
    }
  });
});
