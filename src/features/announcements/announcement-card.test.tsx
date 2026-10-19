import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnnouncementCard, type CardPost } from "./announcement-card";

vi.mock("./reaction-bar", () => ({ ReactionBar: () => null }));
vi.mock("./announcement-form", () => ({ AnnouncementForm: () => null }));
vi.mock("./delete-announcement-button", () => ({ DeleteAnnouncementButton: () => null }));
vi.mock("@/components/full-screen-dialog", () => ({ FullScreenDialog: () => null }));

const NOW = new Date("2026-10-20T12:00:00Z");

const POST: CardPost = {
  id: "00000000-0000-0000-0000-00000000f001",
  title: "Départ place de la République",
  body: "Rendez-vous à 14 h.",
  date: "2026-10-20T10:00:00Z",
  edited: false,
  status: "public",
  imagePath: null,
  imageWidth: null,
  imageHeight: null,
  author: null,
  mine: null,
  canDelete: false,
  reactions: null,
  canReact: false,
};

describe("AnnouncementCard byline", () => {
  it("puts the author before the date, on the line above the title, not between the title and the text", () => {
    const { container } = render(
      <AnnouncementCard
        post={{ ...POST, author: { pseudo: "alice", avatarUrl: null } }}
        now={NOW}
      />,
    );
    const header = container.querySelector("header")!;
    const byline = header.firstElementChild!;
    const title = screen.getByRole("heading", { level: 2, name: POST.title });

    // The pseudo and the date are on the same line, the pseudo first.
    expect(byline).toContainElement(screen.getByText("alice"));
    expect(byline).toContainElement(container.querySelector("time"));
    expect(byline.textContent!.indexOf("alice")).toBeLessThan(
      byline.textContent!.indexOf(container.querySelector("time")!.textContent!),
    );
    // The byline comes before the title, and nothing sits between the title and the text.
    expect(byline.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.nextElementSibling).toBeNull();
    expect(header.nextElementSibling).toHaveTextContent("Rendez-vous à 14 h.");
  });

  it("is small: the picture is the byline size, and 'Par' stays for screen readers", () => {
    const { container } = render(
      <AnnouncementCard
        post={{
          ...POST,
          author: { pseudo: "alice", avatarUrl: "https://cdn.discordapp.com/avatars/1/a.png" },
        }}
        now={NOW}
      />,
    );
    expect(container.querySelector("img")).toHaveClass("h-6", "w-6");
    expect(screen.getByText("Par")).toHaveClass("sr-only");
  });

  it("shows only the date for a post whose author chose to stay hidden", () => {
    const { container } = render(<AnnouncementCard post={POST} now={NOW} />);
    const byline = container.querySelector("header")!.firstElementChild!;
    expect(byline.querySelector("img")).toBeNull();
    expect(byline).not.toHaveTextContent("·");
    expect(byline.querySelector("time")).not.toBeNull();
  });

  it("keeps the edited mark and the visibility chip next to the date", () => {
    const { container } = render(
      <AnnouncementCard
        post={{
          ...POST,
          edited: true,
          status: "private",
          author: { pseudo: "alice", avatarUrl: null },
        }}
        now={NOW}
      />,
    );
    const byline = container.querySelector("header")!.firstElementChild!;
    expect(byline).toHaveTextContent("modifié");
    expect(byline).toHaveTextContent("Privé");
  });
});
