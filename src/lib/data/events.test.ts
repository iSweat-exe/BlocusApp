import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvent, listEventsBetween, listImminentEvents } from "./events";

const maybeSingle = vi.fn();
const eq = vi.fn();
const limit = vi.fn();
const order = vi.fn();
const lt = vi.fn();
const gte = vi.fn();
const gt = vi.fn();
const lte = vi.fn();
const isFn = vi.fn();
const select = vi.fn();
const from = vi.fn();

const cacheLife = vi.fn();
const cacheTag = vi.fn();

vi.mock("next/cache", () => ({
  cacheLife: (...args: unknown[]) => cacheLife(...args),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ gte, gt, eq });
  gt.mockReturnValue({ lte });
  lte.mockReturnValue({ is: isFn });
  isFn.mockReturnValue({ order });
  gte.mockReturnValue({ lt });
  lt.mockReturnValue({ order });
  order.mockReturnValue({ order, limit });
  eq.mockReturnValue({ maybeSingle });
});

const FROM = new Date("2026-10-01T00:00:00Z");
const TO = new Date("2026-11-01T00:00:00Z");

describe("shared cache", () => {
  it("every event read uses the 'feed' profile and the 'events' tag", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await listEventsBetween(FROM, TO);
    await getEvent("e1");
    await listImminentEvents(new Date("2026-10-07T12:00:00Z"), 30);
    expect(cacheLife).toHaveBeenCalledTimes(3);
    expect(cacheLife).toHaveBeenCalledWith("feed");
    expect(cacheTag).toHaveBeenCalledTimes(3);
    expect(cacheTag).toHaveBeenCalledWith("events");
  });
});

describe("listEventsBetween", () => {
  it("queries the half-open range, soonest first", async () => {
    limit.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    expect(await listEventsBetween(FROM, TO)).toEqual({ ok: true, value: [{ id: "e1" }] });
    expect(from).toHaveBeenCalledWith("events");
    expect(gte).toHaveBeenCalledWith("starts_at", FROM.toISOString());
    expect(lt).toHaveBeenCalledWith("starts_at", TO.toISOString());
    expect(order).toHaveBeenCalledWith("starts_at", { ascending: true });
  });

  it("returns load_failed on error or exception", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listEventsBetween(FROM, TO)).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockRejectedValue(new Error("network"));
    expect(await listEventsBetween(FROM, TO)).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("getEvent", () => {
  it("returns the event or null", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "e1" }, error: null });
    expect(await getEvent("e1")).toEqual({ ok: true, value: { id: "e1" } });
    expect(eq).toHaveBeenCalledWith("id", "e1");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getEvent("e2")).toEqual({ ok: true, value: null });
  });

  it("returns load_failed on error or exception", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getEvent("e1")).toMatchObject({ ok: false, error: "load_failed" });
    maybeSingle.mockRejectedValue(new Error("network"));
    expect(await getEvent("e1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("listImminentEvents", () => {
  const NOW = new Date("2026-10-07T12:00:00Z");

  it("queries (now, now + window], soonest first, capped at 3", async () => {
    limit.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    expect(await listImminentEvents(NOW, 30)).toEqual({ ok: true, value: [{ id: "e1" }] });
    expect(gt).toHaveBeenCalledWith("starts_at", "2026-10-07T12:00:00.000Z");
    expect(lte).toHaveBeenCalledWith("starts_at", "2026-10-07T12:30:00.000Z");
    expect(isFn).toHaveBeenCalledWith("finished_at", null);
    expect(limit).toHaveBeenCalledWith(3);
  });

  it("anchors the window to the start of the minute, so a minute is read once for everybody", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await listImminentEvents(new Date("2026-10-07T12:00:42.500Z"), 30);
    expect(gt).toHaveBeenLastCalledWith("starts_at", "2026-10-07T12:00:00.000Z");
    expect(lte).toHaveBeenLastCalledWith("starts_at", "2026-10-07T12:30:00.000Z");
  });

  it("returns load_failed on error or exception", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listImminentEvents(NOW, 30)).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockRejectedValue(new Error("network"));
    expect(await listImminentEvents(NOW, 30)).toMatchObject({ ok: false, error: "load_failed" });
  });
});
