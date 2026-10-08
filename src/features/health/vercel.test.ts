import { describe, expect, it, vi } from "vitest";
import { fetchVercelStatus } from "./vercel";

const env = { VERCEL_API_TOKEN: "tok", VERCEL_PROJECT_ID: "prj_1" };

describe("fetchVercelStatus", () => {
  it("is not configured without token or project", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchVercelStatus({}, fetchImpl)).toEqual({ kind: "not_configured" });
    expect(await fetchVercelStatus({ VERCEL_API_TOKEN: "x" }, fetchImpl)).toEqual({
      kind: "not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads the state of the latest production deployment", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ deployments: [{ state: "READY", created: 1760000000000 }] }),
    );
    const status = await fetchVercelStatus({ ...env, VERCEL_TEAM_ID: "team_1" }, fetchImpl);

    expect(status).toEqual({ kind: "ok", state: "READY", createdAt: 1760000000000 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.vercel.com/v6/deployments?projectId=prj_1&target=production&limit=1&teamId=team_1",
    );
    expect(init?.headers).toEqual({ Authorization: "Bearer tok" });
  });

  it.each([
    ["an HTTP error", async () => new Response("no", { status: 403 })],
    ["an empty list", async () => Response.json({ deployments: [] })],
    ["a network failure", async () => Promise.reject(new Error("offline"))],
  ])("is unavailable on %s", async (_name, impl) => {
    expect(await fetchVercelStatus(env, vi.fn(impl))).toEqual({ kind: "unavailable" });
  });
});
