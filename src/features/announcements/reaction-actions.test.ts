import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { listReactors, toggleReaction } from "./reaction-actions";

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
    await expect(toggleReaction("post", ID, "👍")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("toggle_announcement_reaction", {
      p_announcement_id: ID,
      p_emoji: "👍",
    });
    expect(updateTag).toHaveBeenCalledWith("reactions");
  });

  it("refuses an invalid id or an emoji outside the palette without asking the database", async () => {
    expect((await toggleReaction("post", "nope", "👍")).ok).toBe(false);
    expect((await toggleReaction("post", ID, "🤡")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["rate_limited", "54000", RATE_LIMITED_MESSAGE],
    ["forbidden", "42501", "Connecte-toi avec un compte actif pour réagir."],
    ["unknown_announcement", "22023", "Ce post n'existe plus."],
    ["boom", "XX000", "La réaction a échoué. Réessaie."],
  ])("explains a refusal (%s)", async (message, code, shown) => {
    rpc.mockResolvedValue({ data: null, error: { message, code } });
    await expect(toggleReaction("post", ID, "🔥")).resolves.toEqual({ ok: false, message: shown });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("toggleReaction on an event", () => {
  it("calls the event function", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(toggleReaction("event", ID, "🎉")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("toggle_event_reaction", { p_event_id: ID, p_emoji: "🎉" });
    expect(updateTag).toHaveBeenCalledWith("reactions");
  });

  it("says the event is gone", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unknown_event", code: "22023" } });
    await expect(toggleReaction("event", ID, "🎉")).resolves.toEqual({
      ok: false,
      message: "Cet événement n'existe plus.",
    });
  });

  it("refuses an unknown kind", async () => {
    expect((await toggleReaction("comment", ID, "🎉")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("listReactors", () => {
  it("groups the pseudos by emoji, in palette order", async () => {
    rpc.mockResolvedValue({
      data: [
        { emoji: "🔥", pseudo: "carla" },
        { emoji: "👍", pseudo: "alice" },
        { emoji: "👍", pseudo: "bob" },
      ],
      error: null,
    });
    const result = await listReactors("post", ID);
    expect(rpc).toHaveBeenCalledWith("list_announcement_reactors", { p_announcement_id: ID });
    expect(result).toEqual({ ok: true, reactors: { "👍": ["alice", "bob"], "🔥": ["carla"] } });
    expect(Object.keys(result.ok ? result.reactors : {})).toEqual(["👍", "🔥"]);
  });

  it("asks the event function for an event", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listReactors("event", ID);
    expect(rpc).toHaveBeenCalledWith("list_event_reactors", { p_event_id: ID });
  });

  it("refuses invalid input without asking the database", async () => {
    expect((await listReactors("post", "nope")).ok).toBe(false);
    expect((await listReactors("other", ID)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells a Guest to sign in, and hides database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });
    expect(await listReactors("post", ID)).toEqual({
      ok: false,
      message: "Connecte-toi avec un compte pour voir qui a réagi.",
    });
    rpc.mockResolvedValue({ data: null, error: { message: "boom", code: "XX000" } });
    expect(await listReactors("post", ID)).toEqual({
      ok: false,
      message: "Impossible de charger la liste. Réessaie.",
    });
  });
});
