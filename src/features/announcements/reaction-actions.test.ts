import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { toggleReaction } from "./reaction-actions";

const rpc = vi.fn();
const updateTag = vi.fn();

vi.mock("next/cache", () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/server/log-action-error", () => ({ logActionError: vi.fn() }));

const ID = "00000000-0000-0000-0000-00000000f001";

beforeEach(() => vi.clearAllMocks());

describe("toggleReaction", () => {
  it("calls the database function and refreshes the shared totals", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(toggleReaction(ID, "👍")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("toggle_announcement_reaction", {
      p_announcement_id: ID,
      p_emoji: "👍",
    });
    expect(updateTag).toHaveBeenCalledWith("reactions");
  });

  it("refuses an invalid id or an emoji outside the palette without asking the database", async () => {
    expect((await toggleReaction("nope", "👍")).ok).toBe(false);
    expect((await toggleReaction(ID, "🤡")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["rate_limited", "54000", RATE_LIMITED_MESSAGE],
    ["forbidden", "42501", "Connecte-toi avec un compte actif pour réagir."],
    ["unknown_announcement", "22023", "Ce post n'existe plus."],
    ["boom", "XX000", "La réaction a échoué. Réessaie."],
  ])("explains a refusal (%s)", async (message, code, shown) => {
    rpc.mockResolvedValue({ data: null, error: { message, code } });
    await expect(toggleReaction(ID, "🔥")).resolves.toEqual({ ok: false, message: shown });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
