// Minimal stand-in for Supabase, used only by the end-to-end tests (see playwright.config.ts).
//
// It lets the sign-in and sign-out journeys run for real, without calling Discord or Google: the browser is
// redirected to /auth/v1/authorize, which immediately sends it back to the app with a code; the app's callback
// then exchanges that code (PKCE) for a session, exactly as it does against Supabase.
// Only what the journeys touch is implemented; every other table reads as empty.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const JWT_SECRET = "e2e-only-secret-that-protects-nothing";

const b64url = (input) => Buffer.from(input).toString("base64url");

/** Signs an HS256 JWT (the app falls back to `GET /auth/v1/user` to validate it, which is implemented below). */
function signJwt(claims) {
  const body = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  return `${body}.${createHmac("sha256", JWT_SECRET).update(body).digest("base64url")}`;
}

/** The provider is carried by the code (`<provider>.<random>`), so parallel tests never share state. */
const providerOf = (code) => code.split(".")[0];
const userIdOf = (provider) =>
  provider === "discord"
    ? "00000000-0000-4000-8000-0000000000d1"
    : "00000000-0000-4000-8000-0000000000a2";

function userFor(provider) {
  const id = userIdOf(provider);
  const label = provider === "discord" ? "Discord" : "Google";
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `e2e-${provider}@example.test`,
    created_at: "2020-01-01T00:00:00Z",
    app_metadata: { provider, providers: [provider] },
    user_metadata: { full_name: `E2E ${label}` },
  };
}

function sessionFor(provider) {
  const user = userFor(provider);
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    iss: `http://localhost:${PORT}/auth/v1`,
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    iat: now,
    exp: now + 3600,
    session_id: "00000000-0000-4000-8000-0000000000e5",
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    app_role: "member",
    permissions: [],
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh-${provider}`,
    user,
  };
}

/** The signed-in user, from the bearer token (what Supabase Auth answers to `GET /auth/v1/user`). */
function userFromBearer(request) {
  const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
  const [header, payload, signature] = token.split(".");
  if (!signature) return null;
  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (signature !== expected) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return claims.exp * 1000 > Date.now() ? userFor(claims.app_metadata?.provider) : null;
}

const profileFor = (provider) => ({
  id: userIdOf(provider),
  pseudo: provider === "discord" ? "TesteurDiscord" : "TesteurGoogle",
  avatar_url: null,
  role: "member",
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2020-01-01T00:00:00Z",
});

const send = (response, status, body, headers = {}) => {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(body === undefined ? undefined : JSON.stringify(body));
};

const readBody = (request) =>
  new Promise((resolve) => {
    let data = "";
    request.on("data", (chunk) => (data += chunk));
    request.on("end", () => resolve(data));
  });

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/health") return send(response, 200, { ok: true });

  // The "provider": no consent screen, it sends the user straight back with a code.
  if (path === "/auth/v1/authorize") {
    const provider = url.searchParams.get("provider");
    const redirectTo = url.searchParams.get("redirect_to");
    if (!redirectTo || !url.searchParams.get("code_challenge")) {
      return send(response, 400, { error_code: "validation_failed", msg: "missing parameters" });
    }
    const target = new URL(redirectTo);
    target.searchParams.set("code", `${provider}.${Math.random().toString(36).slice(2)}`);
    response.writeHead(302, { location: target.href });
    return response.end();
  }

  if (path === "/auth/v1/token" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)) || "{}");
    if (url.searchParams.get("grant_type") === "pkce") {
      const code = String(body.auth_code ?? "");
      if (!body.code_verifier || !/^(discord|google)\./.test(code)) {
        return send(response, 400, {
          error_code: "flow_state_not_found",
          msg: "invalid flow state, no valid flow state found",
        });
      }
      return send(response, 200, sessionFor(providerOf(code)));
    }
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const provider = String(body.refresh_token ?? "").replace("refresh-", "");
      return send(response, 200, sessionFor(provider === "discord" ? "discord" : "google"));
    }
    return send(response, 400, { error_code: "validation_failed", msg: "unsupported grant" });
  }

  if (path === "/auth/v1/user") {
    const user = userFromBearer(request);
    return user
      ? send(response, 200, user)
      : send(response, 401, { error_code: "bad_jwt", msg: "invalid JWT" });
  }
  if (path === "/auth/v1/logout") return send(response, 204);
  if (path.startsWith("/auth/v1/")) return send(response, 404, { msg: "not found" });

  // PostgREST: the signed-in user's own profile, nothing else.
  if (path.startsWith("/rest/v1/rpc/")) {
    return path.endsWith("/touch_activity") ? send(response, 204) : send(response, 200, null);
  }
  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    const user = userFromBearer(request);
    const wantsObject = (request.headers.accept ?? "").includes("vnd.pgrst.object");
    const rows = table === "profiles" && user ? [profileFor(user.app_metadata.provider)] : [];
    if (!wantsObject) return send(response, 200, rows);
    return rows.length === 1
      ? send(response, 200, rows[0])
      : send(response, 406, { code: "PGRST116", message: "no rows", details: "", hint: null });
  }

  return send(response, 404, { msg: "not found" });
});

server.listen(PORT, () => process.stdout.write(`fake Supabase listening on ${PORT}\n`));
