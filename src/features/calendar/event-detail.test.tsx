import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventDetail } from "./event-detail";

const getEvent = vi.fn();
const getSessionPermissions = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/data/events", () => ({ getEvent: (...args: unknown[]) => getEvent(...args) }));
vi.mock("@/lib/data/reactions", () => ({
  listEventReactionTotals: vi.fn(async () => ({ ok: true, value: {} })),
  listMyEventReactions: vi.fn(async () => ({ ok: true, value: {} })),
}));
vi.mock("@/server/session", () => ({ getSessionPermissions: () => getSessionPermissions() }));
vi.mock("@/features/announcements/reaction-bar", () => ({
  ReactionBar: ({ kind, className }: { kind: string; className?: string }) => (
    <div data-testid="reactions" data-kind={kind} data-class={className} />
  ),
}));
vi.mock("./actions", () => ({ deleteEvent: vi.fn() }));
vi.mock("./event-form", () => ({ EventForm: () => <p>Formulaire</p> }));
vi.mock("./finish-toggle", () => ({
  FinishToggle: ({ finished }: { finished: boolean }) => (
    <button type="button">{finished ? "Rouvrir" : "Terminer"}</button>
  ),
}));

const ID = "00000000-0000-0000-0000-00000000e001";
// 20 October 2026, 14:00 to 16:30 in Paris (UTC+2).
type Row = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  finished_at: string | null;
};
const EVENT: Row = {
  id: ID,
  author_id: "u-author",
  title: "Départ du cortège",
  description: "Rendez-vous devant la statue.",
  location: "Place de la République",
  starts_at: "2026-10-20T12:00:00Z",
  ends_at: "2026-10-20T14:30:00Z",
  finished_at: null,
};

async function renderEvent(overrides: Partial<Row> = {}) {
  getEvent.mockResolvedValue({ ok: true, value: { ...EVENT, ...overrides } });
  render(await EventDetail({ id: ID }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
  getSessionPermissions.mockResolvedValue(null);
});

describe("EventDetail", () => {
  it("names the page with the event (its only h1), with a way back to that day of the calendar", async () => {
    await renderEvent();
    expect(
      screen.getByRole("heading", { level: 1, name: "Départ du cortège" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const back = screen.getByRole("link", { name: "Calendrier" });
    expect(back).toHaveAttribute("href", "/calendar?month=2026-10&day=2026-10-20");
    expect(back).toHaveClass("min-h-tap");
  });

  it("lists the day, the time with its length, and the place as labelled facts", async () => {
    await renderEvent();
    expect(screen.getByText("Date").nextElementSibling).toHaveTextContent("mardi 20 octobre 2026");
    const time = screen.getByText("Horaire").nextElementSibling!;
    expect(time).toHaveTextContent("14:00 – 16:30");
    expect(time).toHaveTextContent("2 h 30");
    expect(screen.getByText("Lieu").nextElementSibling).toHaveTextContent("Place de la République");
  });

  it("says where the event stands: tomorrow, in progress, over", async () => {
    await renderEvent();
    expect(screen.getByText("Demain")).toBeInTheDocument();
  });

  it("is in progress between its start and its end", async () => {
    vi.setSystemTime(new Date("2026-10-20T13:00:00Z"));
    await renderEvent();
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("is marked over when it was finished, and its title is muted", async () => {
    await renderEvent({ finished_at: "2026-10-20T14:35:00Z" });
    expect(screen.getByText("Terminé")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("text-muted");
    expect(screen.queryByText("Demain")).toBeNull();
  });

  it("leaves out the place and the length when there are none, and says so for an empty description", async () => {
    await renderEvent({ location: "", ends_at: null, description: "" });
    expect(screen.queryByText("Lieu")).toBeNull();
    expect(screen.getByText("Horaire").nextElementSibling).not.toHaveTextContent("·");
    expect(screen.getByText("Pas de description.")).toBeInTheDocument();
  });

  it("shows the reactions under the description, without their own margin", async () => {
    await renderEvent();
    const reactions = screen.getByTestId("reactions");
    expect(reactions).toHaveAttribute("data-kind", "event");
    expect(reactions).toHaveAttribute("data-class", "");
  });

  it("gives a Guest no controls at all", async () => {
    await renderEvent();
    expect(screen.queryByRole("heading", { name: "Gérer l'événement" })).toBeNull();
    expect(screen.queryByText("Supprimer")).toBeNull();
  });

  it("gives people who may manage it their controls last, under their own heading", async () => {
    getSessionPermissions.mockResolvedValue({
      userId: "u-author",
      permissions: ["event.create", "event.finish", "event.delete"],
    });
    await renderEvent();
    const manage = screen.getByRole("region", { name: "Gérer l'événement" });
    expect(within(manage).getByRole("button", { name: "Terminer" })).toBeInTheDocument();
    expect(within(manage).getByText("Modifier")).toBeInTheDocument();
    // The confirmation of a deletion is a danger button, whatever the accent colour is.
    expect(
      within(manage).getByRole("button", { name: "Confirmer la suppression", hidden: true }),
    ).toHaveClass("btn-danger");
  });

  it("only offers what the permissions allow", async () => {
    getSessionPermissions.mockResolvedValue({ userId: "someone", permissions: ["event.finish"] });
    await renderEvent();
    const manage = screen.getByRole("region", { name: "Gérer l'événement" });
    expect(within(manage).getByRole("button", { name: "Terminer" })).toBeInTheDocument();
    expect(within(manage).queryByText("Modifier")).toBeNull();
    expect(within(manage).queryByText("Supprimer")).toBeNull();
  });

  it("shows an error with a way back when the event cannot be loaded, and a 404 when it does not exist", async () => {
    getEvent.mockResolvedValue({ ok: false });
    render(await EventDetail({ id: ID }));
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger");
    expect(screen.getByRole("link", { name: "Calendrier" })).toHaveAttribute("href", "/calendar");

    getEvent.mockResolvedValue({ ok: true, value: null });
    await expect(EventDetail({ id: ID })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
