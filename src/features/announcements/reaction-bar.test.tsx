import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionBar } from "./reaction-bar";

const toggleReaction = vi.fn();
const listReactors = vi.fn();
vi.mock("./reaction-actions", () => ({
  toggleReaction: (...args: unknown[]) => toggleReaction(...args),
  listReactors: (...args: unknown[]) => listReactors(...args),
}));

const ID = "00000000-0000-0000-0000-00000000f001";
const STATE = { counts: { "👍": 2, "🔥": 1 }, mine: ["🔥" as const] };

beforeEach(() => {
  vi.clearAllMocks();
  toggleReaction.mockResolvedValue({ ok: true });
  listReactors.mockResolvedValue({
    ok: true,
    reactors: { "👍": ["alice", "bob"], "🔥": ["carla"] },
  });
});

describe("ReactionBar", () => {
  it("shows the totals and highlights the viewer's own reactions", () => {
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);
    expect(screen.getByRole("button", { name: "pouce levé : 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "feu : 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the totals to a Guest without any button", () => {
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact={false} />);
    expect(screen.getByRole("img", { name: "pouce levé : 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for a Guest when nobody reacted", () => {
    const { container } = render(
      <ReactionBar kind="post" targetId={ID} state={{ counts: {}, mine: [] }} canReact={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("sends the tap on an existing reaction to the server", async () => {
    const user = userEvent.setup();
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);

    await user.click(screen.getByRole("button", { name: "pouce levé : 2" }));
    expect(toggleReaction).toHaveBeenCalledWith("post", ID, "👍");
  });

  it("adds a new emoji from the palette, then closes it", async () => {
    const user = userEvent.setup();
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);

    await user.click(screen.getByRole("button", { name: "Ajouter une réaction" }));
    await user.click(screen.getByRole("button", { name: "applaudissements" }));
    expect(toggleReaction).toHaveBeenCalledWith("post", ID, "👏");
    expect(screen.queryByRole("list", { name: "Choisir une réaction" })).toBeNull();
  });

  it("shows why the server refused", async () => {
    toggleReaction.mockResolvedValue({ ok: false, message: "Trop d'actions" });
    const user = userEvent.setup();
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);

    await user.click(screen.getByRole("button", { name: "pouce levé : 2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop d'actions");
  });

  it("works the same on an event", async () => {
    const user = userEvent.setup();
    render(<ReactionBar kind="event" targetId={ID} state={STATE} canReact />);
    await user.click(screen.getByRole("button", { name: "pouce levé : 2" }));
    expect(toggleReaction).toHaveBeenCalledWith("event", ID, "👍");
  });

  it("lists who reacted on demand, by emoji, and hides the list again", async () => {
    const user = userEvent.setup();
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);
    expect(listReactors).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Qui a réagi ?" }));
    const list = await screen.findByRole("list", { name: "Qui a réagi" });
    expect(listReactors).toHaveBeenCalledWith("post", ID);
    expect(list).toHaveTextContent("alice, bob");
    expect(list).toHaveTextContent("carla");

    await user.click(screen.getByRole("button", { name: "Masquer" }));
    expect(screen.queryByRole("list", { name: "Qui a réagi" })).toBeNull();
  });

  it("never offers the list to a Guest", () => {
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact={false} />);
    expect(screen.queryByRole("button", { name: "Qui a réagi ?" })).toBeNull();
  });

  it("does not offer the list when nobody reacted", () => {
    render(<ReactionBar kind="post" targetId={ID} state={{ counts: {}, mine: [] }} canReact />);
    expect(screen.queryByRole("button", { name: "Qui a réagi ?" })).toBeNull();
  });

  it("shows why the list could not be read", async () => {
    listReactors.mockResolvedValue({ ok: false, message: "Impossible de charger la liste." });
    const user = userEvent.setup();
    render(<ReactionBar kind="post" targetId={ID} state={STATE} canReact />);
    await user.click(screen.getByRole("button", { name: "Qui a réagi ?" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger");
  });
});
