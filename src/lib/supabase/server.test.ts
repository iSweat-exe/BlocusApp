import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

const { createClient } = await import("./server");

/** A minimal cookie store: what the browser would send back on the next request. */
function createJar() {
  const jar = new Map<string, string>();
  return {
    jar,
    store: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => void jar.set(name, value),
    } as unknown as Parameters<typeof createClient>[0],
  };
}

async function start(store: Parameters<typeof createClient>[0]) {
  const { data, error } = await createClient(store).auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: "https://blocus.app/auth/callback", skipBrowserRedirect: true },
  });
  expect(error).toBeNull();
  const url = new URL(data.url ?? "");
  const redirectTo = new URL(url.searchParams.get("redirect_to") ?? "");
  return {
    flowId: redirectTo.searchParams.get("sb_flow_id"),
    challenge: url.searchParams.get("code_challenge"),
  };
}

describe("createClient (server)", () => {
  it("tags each OAuth start with its own flow id and keeps one verifier cookie per flow", async () => {
    const { jar, store } = createJar();

    const first = await start(store);
    const second = await start(store);

    expect(first.flowId).toBeTruthy();
    expect(second.flowId).toBeTruthy();
    expect(first.flowId).not.toBe(second.flowId);
    expect(first.challenge).not.toBe(second.challenge);
    // The first verifier survives the second start, so its callback can still be exchanged.
    const names = [...jar.keys()];
    expect(names.some((name) => name.includes(`flow-${first.flowId}-code-verifier`))).toBe(true);
    expect(names.some((name) => name.includes(`flow-${second.flowId}-code-verifier`))).toBe(true);
  });
});
