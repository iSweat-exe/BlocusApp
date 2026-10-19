import { beforeEach, describe, expect, it, vi } from "vitest";
import { broadcastPush, isPushConfigured } from "./push";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
const select = vi.fn();
const inFn = vi.fn();
const deleteFn = vi.fn();
const from = vi.fn();

vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));
vi.mock("@/lib/site", () => ({ getSiteUrl: () => "https://blocus.app" }));

const MESSAGE = { title: "Nouveau post", body: "Départ", path: "/", tag: "post-1" };
const row = (n: number) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  p256dh: "k",
  auth: "a",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:team@blocus.app");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  sendNotification.mockResolvedValue({ statusCode: 201 });
  deleteFn.mockReturnValue({ in: inFn });
  inFn.mockResolvedValue({ error: null });
  from.mockReturnValue({ select, delete: deleteFn });
  select.mockResolvedValue({ data: [row(1), row(2)], error: null });
});

describe("isPushConfigured", () => {
  it("needs both VAPID keys, the subject and the service role", () => {
    expect(isPushConfigured()).toBe(true);
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(isPushConfigured()).toBe(false);
  });
});

describe("broadcastPush", () => {
  it("does nothing when push is not configured (previews, local development)", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await expect(broadcastPush(MESSAGE)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(from).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends the message to every subscription, with the site URL to open", async () => {
    await expect(broadcastPush(MESSAGE)).resolves.toEqual({ sent: 2, removed: 0, failed: 0 });
    expect(setVapidDetails).toHaveBeenCalledWith("mailto:team@blocus.app", "public", "private");
    expect(sendNotification).toHaveBeenCalledTimes(2);

    const [subscription, payload, options] = sendNotification.mock.calls[0]!;
    expect(subscription).toEqual({ endpoint: row(1).endpoint, keys: { p256dh: "k", auth: "a" } });
    expect(JSON.parse(payload as string).notification).toMatchObject({
      title: "Nouveau post",
      navigate: "https://blocus.app/",
      tag: "post-1",
    });
    expect(options).toMatchObject({ TTL: 86400, urgency: "normal" });
  });

  it("deletes the subscriptions the push service reports as gone (404 and 410), and counts other failures", async () => {
    select.mockResolvedValue({ data: [row(1), row(2), row(3)], error: null });
    sendNotification
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 500 });
    await expect(broadcastPush(MESSAGE)).resolves.toEqual({ sent: 0, removed: 2, failed: 1 });
    expect(inFn).toHaveBeenCalledWith("endpoint", [row(1).endpoint, row(2).endpoint]);
  });

  it("never throws, and never logs an endpoint", async () => {
    select.mockResolvedValue({ data: null, error: { message: "db down" } });
    await expect(broadcastPush(MESSAGE)).resolves.toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(console.error).toHaveBeenCalledWith("[broadcastPush] failed:", "db down");
  });

  it("sends by batches so a large audience does not open hundreds of connections at once", async () => {
    select.mockResolvedValue({ data: Array.from({ length: 45 }, (_, i) => row(i)), error: null });
    let running = 0;
    let peak = 0;
    sendNotification.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
    });
    const result = await broadcastPush(MESSAGE);
    expect(result.sent).toBe(45);
    expect(peak).toBeLessThanOrEqual(20);
  });
});
