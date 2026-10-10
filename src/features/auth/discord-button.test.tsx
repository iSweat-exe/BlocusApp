import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscordButton } from "./discord-button";

afterEach(() => vi.unstubAllGlobals());

describe("DiscordButton", () => {
  it("asks the server for the Discord URL once, even when effects run twice (Strict Mode)", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ url: "https://discord.com/oauth2/authorize?client_id=1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <DiscordButton />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Discord/ })).toHaveAttribute(
        "href",
        "https://discord.com/oauth2/authorize?client_id=1",
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the Discord logo, hidden from assistive technologies: the text names the link", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<DiscordButton />);
    const link = screen.getByRole("link", { name: "Continuer avec Discord" });
    const logo = link.querySelector("svg");
    expect(logo).toHaveAttribute("aria-hidden", "true");
    expect(logo).toHaveAttribute("focusable", "false");
  });

  it("keeps the server-redirect link when the URL cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<DiscordButton />);
    await Promise.resolve();
    expect(screen.getByRole("link", { name: /Discord/ })).toHaveAttribute(
      "href",
      "/auth/login/discord",
    );
  });
});
