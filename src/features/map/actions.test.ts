import { beforeEach, describe, expect, it, vi } from "vitest";
import { declareMapPosition, saveMapRoute } from "./actions";

const requirePermission = vi.fn();
const rpc = vi.fn();
const updateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
  updateTag: (...args: unknown[]) => updateTag(...args),
}));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

const BASE = "00000000-0000-0000-0000-00000000b001";
const POINTS = [
  [2.3, 48.8],
  [2.4, 48.9],
];

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
  rpc.mockResolvedValue({ data: "new-version-id", error: null });
});

describe("saveMapRoute", () => {
  it("checks map.route.edit against the database, not the token", async () => {
    await saveMapRoute(POINTS, null);
    expect(requirePermission).toHaveBeenCalledWith("map.route.edit", { fresh: true });
  });

  it("refuses a Guest and a user without the permission, before touching the database", async () => {
    requirePermission.mockResolvedValueOnce({ ok: false, error: "unauthenticated" });
    expect(await saveMapRoute(POINTS, null)).toMatchObject({ code: "unauthenticated" });
    requirePermission.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    expect(await saveMapRoute(POINTS, null)).toMatchObject({ code: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the points and the base version at the boundary", async () => {
    for (const bad of [
      null,
      "x",
      [[1, 1]],
      [
        [1, 1],
        [999, 1],
      ],
    ]) {
      expect(await saveMapRoute(bad, null)).toMatchObject({ code: "invalid" });
    }
    expect(await saveMapRoute(POINTS, "not-a-uuid")).toMatchObject({ code: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves the cleaned points with the base version and refreshes the shared cache", async () => {
    const result = await saveMapRoute(
      [
        [2.1234567891, 48.8],
        [2.4, 48.9],
      ],
      BASE,
    );
    expect(rpc).toHaveBeenCalledWith("save_map_route", {
      p_points: [
        [2.123457, 48.8],
        [2.4, 48.9],
      ],
      p_base: BASE,
    });
    expect(result).toEqual({ status: "success", versionId: "new-version-id" });
    expect(updateTag).toHaveBeenCalledWith("map-route");
    expect(revalidatePath).toHaveBeenCalledWith("/map");
  });

  it("clears the route with an empty list", async () => {
    await saveMapRoute([], BASE);
    expect(rpc).toHaveBeenCalledWith("save_map_route", { p_points: [], p_base: BASE });
  });

  it("tells the editor when somebody else saved first, and on any other failure", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "stale_route" } });
    expect(await saveMapRoute(POINTS, BASE)).toMatchObject({ code: "stale" });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await saveMapRoute(POINTS, BASE)).toMatchObject({ code: "failed" });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("declareMapPosition", () => {
  it("checks map.position.declare against the database, not the token", async () => {
    await declareMapPosition(2.3, 48.8, "");
    expect(requirePermission).toHaveBeenCalledWith("map.position.declare", { fresh: true });
  });

  it("refuses a Guest and a user without the permission, before touching the database", async () => {
    requirePermission.mockResolvedValueOnce({ ok: false, error: "unauthenticated" });
    expect(await declareMapPosition(2.3, 48.8, "")).toMatchObject({ code: "unauthenticated" });
    requirePermission.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    expect(await declareMapPosition(2.3, 48.8, "")).toMatchObject({ code: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the coordinates and the label at the boundary", async () => {
    const bad: [unknown, unknown, unknown][] = [
      ["2", 48, ""],
      [2, null, ""],
      [181, 48, ""],
      [2, 91, ""],
      [Number.NaN, 48, ""],
      [2, 48, 42],
      [2, 48, "a".repeat(81)],
    ];
    for (const [lng, lat, label] of bad) {
      expect(await declareMapPosition(lng, lat, label)).toMatchObject({ code: "invalid" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("declares with a trimmed label and refreshes the shared cache", async () => {
    rpc.mockResolvedValue({ data: "p1", error: null });
    expect(await declareMapPosition(2.3, 48.8, "  Place  ")).toEqual({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("declare_map_position", {
      p_lng: 2.3,
      p_lat: 48.8,
      p_label: "Place",
    });
    expect(updateTag).toHaveBeenCalledWith("map-positions");
    expect(revalidatePath).toHaveBeenCalledWith("/map");
  });

  it("accepts a missing label", async () => {
    rpc.mockResolvedValue({ data: "p1", error: null });
    expect(await declareMapPosition(2.3, 48.8, undefined)).toEqual({ status: "success" });
  });

  it("tells the manager to wait on a rate limit, and reports any other failure", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "rate_limited" } });
    expect(await declareMapPosition(2.3, 48.8, "")).toMatchObject({ code: "rate_limited" });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await declareMapPosition(2.3, 48.8, "")).toMatchObject({ code: "failed" });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
