import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { removePushSubscription, savePushSubscription } from "./actions";

const rpc = vi.fn();

vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/server/log-action-error", () => ({ logActionError: vi.fn() }));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123def456";
const SUBSCRIPTION = { endpoint: ENDPOINT, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("savePushSubscription", () => {
  it("saves the subscription through the database function", async () => {
    await expect(savePushSubscription(SUBSCRIPTION)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("save_push_subscription", {
      p_endpoint: ENDPOINT,
      p_p256dh: SUBSCRIPTION.keys.p256dh,
      p_auth: SUBSCRIPTION.keys.auth,
    });
  });

  it("refuses an invalid subscription without calling the database", async () => {
    const result = await savePushSubscription({ endpoint: "https://evil.example.com/x", keys: {} });
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["rate_limited", "54000", RATE_LIMITED_MESSAGE],
    ["forbidden", "42501", "Connecte-toi avec un compte actif pour activer les notifications."],
    ["boom", "XX000", "L'opération a échoué. Réessaie."],
  ])("explains a refusal (%s)", async (message, code, shown) => {
    rpc.mockResolvedValue({ data: null, error: { message, code } });
    await expect(savePushSubscription(SUBSCRIPTION)).resolves.toEqual({
      ok: false,
      message: shown,
    });
  });
});

describe("removePushSubscription", () => {
  it("removes the subscription of this device", async () => {
    await expect(removePushSubscription(ENDPOINT)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("remove_push_subscription", { p_endpoint: ENDPOINT });
  });

  it("refuses an endpoint that is not a push service", async () => {
    expect((await removePushSubscription("https://evil.example.com/x")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
