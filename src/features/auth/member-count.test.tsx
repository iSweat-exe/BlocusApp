import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberCount } from "./member-count";

const getPublicUserCount = vi.fn();
vi.mock("@/lib/data/user-count", () => ({ getPublicUserCount: () => getPublicUserCount() }));

beforeEach(() => {
  getPublicUserCount.mockReset();
});

async function show() {
  return render(await MemberCount());
}

describe("MemberCount", () => {
  it("says how many people joined, with a French thousands separator", async () => {
    getPublicUserCount.mockResolvedValue({ ok: true, value: 1842 });
    await show();
    const line = screen.getByText(/ont rejoint BLOCUS/);
    expect(line.textContent).toMatch(/^Déjà 1\s842 personnes ont rejoint BLOCUS\.$/);
  });

  it("agrees in the singular", async () => {
    getPublicUserCount.mockResolvedValue({ ok: true, value: 1 });
    await show();
    expect(screen.getByText(/a rejoint BLOCUS/).textContent).toBe(
      "Déjà 1 personne a rejoint BLOCUS.",
    );
  });

  it("shows nothing when the figure cannot be read", async () => {
    getPublicUserCount.mockResolvedValue({ ok: false, error: "load_failed" });
    const { container } = await show();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when nobody has signed up yet", async () => {
    getPublicUserCount.mockResolvedValue({ ok: true, value: 0 });
    const { container } = await show();
    expect(container).toBeEmptyDOMElement();
  });
});
