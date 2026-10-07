import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeLike, getProfile, getPseudos, listProfiles, listRoles } from "./profiles";

const ilike = vi.fn();
const limit = vi.fn();
const orderProfiles = vi.fn();
const orderRoles = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

// The profiles query is awaited directly or after `.ilike()`, so it must be thenable and chainable.
const profilesQuery = (result: unknown) =>
  Object.assign(Promise.resolve(result), { ilike: ilike.mockResolvedValue(result) });

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ order: orderProfiles });
  orderProfiles.mockReturnValue({ limit });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("listProfiles", () => {
  it("lists profiles without filter", async () => {
    limit.mockReturnValue(profilesQuery({ data: [{ id: "1" }], error: null }));
    expect(await listProfiles("  ")).toEqual({ ok: true, value: [{ id: "1" }] });
    expect(ilike).not.toHaveBeenCalled();
  });

  it("filters by an escaped, trimmed search term", async () => {
    limit.mockReturnValue(profilesQuery({ data: [], error: null }));
    await listProfiles(" a%b ");
    expect(ilike).toHaveBeenCalledWith("pseudo", "%a\\%b%");
  });

  it("returns load_failed on error or exception", async () => {
    limit.mockReturnValue(profilesQuery({ data: null, error: { message: "boom" } }));
    expect(await listProfiles()).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockImplementation(() => {
      throw new Error("network");
    });
    expect(await listProfiles()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("listRoles", () => {
  it("returns the roles ordered by rank", async () => {
    select.mockReturnValue({ order: orderRoles });
    orderRoles.mockResolvedValue({ data: [{ key: "user", label: "U", rank: 10 }], error: null });
    expect(await listRoles()).toEqual({ ok: true, value: [{ key: "user", label: "U", rank: 10 }] });
    expect(orderRoles).toHaveBeenCalledWith("rank");
  });

  it("returns load_failed on error", async () => {
    select.mockReturnValue({ order: orderRoles });
    orderRoles.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listRoles()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("getProfile", () => {
  const maybeSingle = vi.fn();
  beforeEach(() => {
    select.mockReturnValue({ eq: vi.fn(() => ({ maybeSingle })) });
  });

  it("returns the profile or null", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "1" }, error: null });
    expect(await getProfile("1")).toEqual({ ok: true, value: { id: "1" } });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getProfile("2")).toEqual({ ok: true, value: null });
  });

  it("returns load_failed on error or exception", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getProfile("1")).toMatchObject({ ok: false, error: "load_failed" });
    maybeSingle.mockRejectedValue(new Error("network"));
    expect(await getProfile("1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("getPseudos", () => {
  const inFn = vi.fn();
  beforeEach(() => {
    select.mockReturnValue({ in: inFn });
  });

  it("returns an empty map without querying when there is nothing to resolve", async () => {
    expect(await getPseudos([])).toEqual({ ok: true, value: new Map() });
    expect(from).not.toHaveBeenCalled();
  });

  it("deduplicates ids and maps id to pseudo", async () => {
    inFn.mockResolvedValue({ data: [{ id: "a", pseudo: "alice" }], error: null });
    const result = await getPseudos(["a", "a", "b"]);
    expect(inFn).toHaveBeenCalledWith("id", ["a", "b"]);
    expect(result.ok && result.value.get("a")).toBe("alice");
    expect(result.ok && result.value.has("b")).toBe(false);
  });

  it("returns load_failed on error or exception", async () => {
    inFn.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getPseudos(["a"])).toMatchObject({ ok: false, error: "load_failed" });
    inFn.mockRejectedValue(new Error("network"));
    expect(await getPseudos(["a"])).toMatchObject({ ok: false, error: "load_failed" });
  });
});
