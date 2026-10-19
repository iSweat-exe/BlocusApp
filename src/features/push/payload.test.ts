import { describe, expect, it } from "vitest";
import { buildPushPayload } from "./payload";

const parse = (json: string) => JSON.parse(json) as Record<string, unknown>;

describe("buildPushPayload", () => {
  it("uses the Declarative Web Push format, with the page to open", () => {
    const payload = parse(
      buildPushPayload({
        title: "Nouveau post",
        body: "Départ à 14h",
        url: "https://blocus.app/",
        tag: "post-1",
      }),
    );
    expect(payload).toEqual({
      web_push: 8030,
      notification: {
        title: "Nouveau post",
        body: "Départ à 14h",
        navigate: "https://blocus.app/",
        tag: "post-1",
      },
    });
  });

  it("cuts long texts and flattens line breaks, to stay far below the 4 KB limit", () => {
    const { notification } = parse(
      buildPushPayload({
        title: "T".repeat(200),
        body: `ligne un\n\nligne   deux ${"x".repeat(500)}`,
        url: "https://blocus.app/",
        tag: "t",
      }),
    ) as { notification: { title: string; body: string } };
    expect(notification.title).toHaveLength(60);
    expect(notification.title.endsWith("…")).toBe(true);
    expect(notification.body).toHaveLength(140);
    expect(notification.body.startsWith("ligne un ligne deux")).toBe(true);
  });
});
