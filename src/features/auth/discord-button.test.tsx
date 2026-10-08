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
