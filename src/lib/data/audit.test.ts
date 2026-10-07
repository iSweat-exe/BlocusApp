import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_PAGE_SIZE, listAuditLogs } from "./audit";

const lt = vi.fn();
const eq = vi.fn();
const limit = vi.fn();
const order = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

// The query is awaited directly or after `.eq()` / `.lt()`, so it must be thenable and chainable.
const query = (result: unknown) => {
  const chain: Record<string, unknown> = Promise.resolve(result) as unknown as Record<
    string,
    unknown
  >;
  chain.eq = eq.mockReturnValue(chain);
  chain.lt = lt.mockReturnValue(chain);
  return chain;
};
const rows = (count: number, from = count) =>
  Array.from({ length: count }, (_, index) => ({ id: from - index }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ order });
  order.mockReturnValue({ limit });
});

describe("listAuditLogs", () => {
  it("returns a last page without a cursor", async () => {
    limit.mockReturnValue(query({ data: rows(3), error: null }));
    expect(await listAuditLogs()).toEqual({
      ok: true,
      value: { entries: rows(3), nextCursor: null },
    });
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(limit).toHaveBeenCalledWith(AUDIT_PAGE_SIZE + 1);
  });

  it("drops the extra row and exposes the cursor when another page exists", async () => {
    limit.mockReturnValue(query({ data: rows(AUDIT_PAGE_SIZE + 1), error: null }));
    const result = await listAuditLogs();
    expect(result.ok && result.value.entries).toHaveLength(AUDIT_PAGE_SIZE);
    expect(result.ok && result.value.nextCursor).toBe(2);
  });

  it("applies the action filter and the cursor", async () => {
    limit.mockReturnValue(query({ data: [], error: null }));
    await listAuditLogs({ action: "user.banned", before: 10 });
    expect(eq).toHaveBeenCalledWith("action", "user.banned");
    expect(lt).toHaveBeenCalledWith("id", 10);
  });

  it("returns load_failed on error or exception", async () => {
    limit.mockReturnValue(query({ data: null, error: { message: "boom" } }));
    expect(await listAuditLogs()).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockImplementation(() => {
      throw new Error("network");
    });
    expect(await listAuditLogs()).toMatchObject({ ok: false, error: "load_failed" });
  });
});
