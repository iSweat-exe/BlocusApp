// Minimal stand-in for Supabase, used only by the end-to-end tests (see playwright.config.ts).
//
// It lets the sign-in and sign-out journeys run for real, without calling Discord or Google: the browser is
// redirected to /auth/v1/authorize, which immediately sends it back to the app with a code; the app's callback
// then exchanges that code (PKCE) for a session, exactly as it does against Supabase.
//
// Beyond sign-in it keeps a small in-memory database for the three journeys that matter most (publish a post, react
// to it, declare the position of the demonstration): posts, reactions and positions, with just enough of PostgREST
// (filters, order, limit, single object) and of the database functions the app calls. Every other table reads as
// empty. The data lives as long as the process: tests create rows with their own unique titles.
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
const JWT_SECRET = "e2e-only-secret-that-protects-nothing";

const b64url = (input) => Buffer.from(input).toString("base64url");

/** Signs an HS256 JWT (the app falls back to `GET /auth/v1/user` to validate it, which is implemented below). */
function signJwt(claims) {
  const body = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  return `${body}.${createHmac("sha256", JWT_SECRET).update(body).digest("base64url")}`;
}

// The code carries the provider and the scenario (`<provider>.<scenario>.<random>`), so parallel tests never
// share state. Scenarios: `ok` (verified e-mail, a plain member), `manager` (verified e-mail, may publish posts and
// declare the position), `unverified` (address the provider did not verify) and `new-unverified` (same, on an
// account created just now).
const SCENARIOS = "ok|manager|unverified|new-unverified";
const partsOf = (code) => {
  const [provider, scenario = "ok"] = code.split(".");
  return { provider, scenario };
};

const IDS = {
  ok: {
    discord: "00000000-0000-4000-8000-0000000000d1",
    google: "00000000-0000-4000-8000-0000000000a2",
  },
  manager: {
    discord: "00000000-0000-4000-8000-0000000000f1",
    google: "00000000-0000-4000-8000-0000000000f2",
  },
};
const userIdOf = (provider, scenario = "ok") =>
  IDS[scenario]?.[provider] ??
  `00000000-0000-4000-8000-00000000${scenario === "unverified" ? "0b" : "0c"}${provider === "discord" ? "d1" : "a2"}`;

const MANAGER_PERMISSIONS = ["announcement.publish", "announcement.delete", "map.position.declare"];
const permissionsOf = (scenario) => (scenario === "manager" ? MANAGER_PERMISSIONS : []);
const pseudoOf = (provider, scenario) =>
  `${scenario === "manager" ? "Gerant" : "Testeur"}${provider === "discord" ? "Discord" : "Google"}`;

/** Ids of the accounts the app asked to delete (`DELETE /auth/v1/admin/users/:id`), for the tests to read. */
const deletedUsers = [];

function userFor(provider, scenario = "ok") {
  const id = userIdOf(provider, scenario);
  const label = provider === "discord" ? "Discord" : "Google";
  const verified = scenario === "ok" || scenario === "manager";
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `e2e-${provider}@example.test`,
    email_confirmed_at: verified ? "2020-01-01T00:00:00Z" : null,
    created_at: scenario === "new-unverified" ? new Date().toISOString() : "2020-01-01T00:00:00Z",
    app_metadata: { provider, providers: [provider], scenario },
    user_metadata: { full_name: `E2E ${label}` },
    identities: [{ identity_data: { email_verified: verified } }],
  };
}

function sessionFor(provider, scenario = "ok") {
  const user = userFor(provider, scenario);
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
    app_role: scenario === "manager" ? "manager" : "member",
    permissions: permissionsOf(scenario),
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    // The scenario travels with the refresh token, so a refreshed session keeps its permissions.
    refresh_token: `refresh-${provider}-${scenario}`,
    user,
  };
}

/** The signed-in user and the permissions of the token, from the bearer (what `GET /auth/v1/user` answers). */
function sessionFromBearer(request) {
  const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
  const [header, payload, signature] = token.split(".");
  if (!signature) return null;
  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (signature !== expected) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (claims.exp * 1000 <= Date.now()) return null;
  const { provider, scenario } = claims.app_metadata ?? {};
  return {
    user: userFor(provider, scenario),
    provider,
    scenario,
    permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
  };
}
const userFromBearer = (request) => sessionFromBearer(request)?.user ?? null;

const profileFor = (provider, scenario = "ok") => ({
  id: userIdOf(provider, scenario),
  pseudo: pseudoOf(provider, scenario),
  avatar_url: null,
  role: scenario === "manager" ? "manager" : "member",
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2020-01-01T00:00:00Z",
});

// ---------------------------------------------------------------------------------------------------------------
// The in-memory database.

const db = {
  /** Rows of `announcements` (every status). */
  announcements: [],
  /** Rows of `announcement_reactions`: { announcement_id, user_id, emoji, created_at }. */
  reactions: [],
  /** Rows of `map_positions`. */
  positions: [],
};

/** Pseudo of a user id, from the profiles of the scenarios above. */
function pseudoByUserId(userId) {
  for (const scenario of ["ok", "manager"]) {
    for (const provider of ["discord", "google"]) {
      if (userIdOf(provider, scenario) === userId) return pseudoOf(provider, scenario);
    }
  }
  return null;
}

/** What the `announcement_feed` view shows: public posts, the author only when they chose to be shown. */
function feedRows() {
  return db.announcements
    .filter((post) => post.status === "public")
    .map((post) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      published_at: post.published_at,
      edited_at: post.edited_at,
      image_path: post.image_path,
      image_width: post.image_width,
      image_height: post.image_height,
      author_id: post.show_author ? post.author_id : null,
      author_pseudo: post.show_author ? pseudoByUserId(post.author_id) : null,
      author_avatar_url: null,
    }));
}

/** What the `announcement_reaction_counts` view shows: one row per public post and emoji. */
function reactionCountRows() {
  const publicIds = new Set(db.announcements.filter((p) => p.status === "public").map((p) => p.id));
  const totals = new Map();
  for (const reaction of db.reactions) {
    if (!publicIds.has(reaction.announcement_id)) continue;
    const key = `${reaction.announcement_id}|${reaction.emoji}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals].map(([key, total]) => {
    const [announcement_id, emoji] = key.split("|");
    return { announcement_id, emoji, total };
  });
}

/** The few PostgREST filters the app uses: `eq`, `neq`, `in`, `is`, then `order` and `limit`. */
function applyQuery(rows, url) {
  const reserved = new Set(["select", "order", "limit", "offset"]);
  let result = rows.filter((row) =>
    [...url.searchParams.entries()].every(([column, expression]) => {
      if (reserved.has(column)) return true;
      const dot = expression.indexOf(".");
      const operator = expression.slice(0, dot);
      const argument = expression.slice(dot + 1);
      const value = row[column];
      switch (operator) {
        case "eq":
          return String(value) === argument;
        case "neq":
          return String(value) !== argument;
        case "is":
          return argument === "null"
            ? value === null || value === undefined
            : String(value) === argument;
        case "in":
          return argument
            .slice(1, -1)
            .split(",")
            .map((item) => item.replace(/^"|"$/g, ""))
            .includes(String(value));
        default:
          return true;
      }
    }),
  );

  const order = url.searchParams.get("order");
  if (order) {
    const keys = order.split(",").map((part) => {
      const [column, direction = "asc"] = part.split(".");
      return { column, sign: direction === "desc" ? -1 : 1 };
    });
    result = [...result].sort((a, b) => {
      for (const { column, sign } of keys) {
        if (a[column] === b[column]) continue;
        return (a[column] > b[column] ? 1 : -1) * sign;
      }
      return 0;
    });
  }
  const limit = Number(url.searchParams.get("limit"));
  return Number.isInteger(limit) && limit > 0 ? result.slice(0, limit) : result;
}

/** The tables and views the app reads. */
function tableRows(table, session) {
  switch (table) {
    case "profiles":
      return session ? [profileFor(session.provider, session.scenario)] : [];
    case "announcement_feed":
      return feedRows();
    case "announcements":
      return db.announcements;
    case "announcement_reaction_counts":
      return reactionCountRows();
    case "announcement_reactions":
      // Row Level Security: a user only reads their own reactions.
      return session ? db.reactions.filter((row) => row.user_id === session.user.id) : [];
    case "map_positions":
      return db.positions;
    default:
      return [];
  }
}

/** The database functions the app calls. Returns the JSON answer, or throws `{ status, body }` for an error. */
function callFunction(name, args, session) {
  const refuse = (code, message) => {
    throw { status: 400, body: { code, message, details: null, hint: null } };
  };
  switch (name) {
    case "touch_activity":
      return null;
    case "has_permission":
      return session ? session.permissions.includes(args.p_permission) : false;
    case "toggle_announcement_reaction": {
      if (!session) refuse("42501", "forbidden");
      const post = db.announcements.find(
        (p) => p.id === args.p_announcement_id && p.status === "public",
      );
      if (!post) refuse("22023", "unknown_announcement");
      const index = db.reactions.findIndex(
        (r) =>
          r.announcement_id === post.id &&
          r.user_id === session.user.id &&
          r.emoji === args.p_emoji,
      );
      if (index >= 0) {
        db.reactions.splice(index, 1);
        return false;
      }
      db.reactions.push({
        announcement_id: post.id,
        user_id: session.user.id,
        emoji: args.p_emoji,
        created_at: new Date().toISOString(),
      });
      return true;
    }
    case "list_announcement_reactors": {
      if (!session) refuse("42501", "forbidden");
      return db.reactions
        .filter((r) => r.announcement_id === args.p_announcement_id)
        .map((r) => ({ emoji: r.emoji, pseudo: pseudoByUserId(r.user_id) ?? "inconnu" }));
    }
    case "declare_map_position": {
      if (!session || !session.permissions.includes("map.position.declare"))
        refuse("42501", "forbidden");
      db.positions.push({
        id: randomUUID(),
        lng: args.p_lng,
        lat: args.p_lat,
        label: args.p_label ?? "",
        declared_at: new Date().toISOString(),
        author_id: session.user.id,
        removed_at: null,
      });
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------

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

/** What the app sends to create a post, completed the way the table's defaults and triggers do. */
function newAnnouncement(input, session) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    author_id: input.author_id ?? session?.user.id ?? null,
    title: input.title,
    body: input.body,
    status: input.status ?? "public",
    show_author: input.show_author === true,
    image_path: input.image_path ?? null,
    image_width: input.image_width ?? null,
    image_height: input.image_height ?? null,
    published_at: (input.status ?? "public") === "public" ? now : null,
    edited_at: null,
    created_at: now,
    updated_at: now,
  };
}

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
    // A test picks the scenario with an `e2e_scenario` cookie: cookies ignore ports, so the app's origin sets it
    // for this one's too, and each test has its own browser context.
    const scenario =
      /(?:^|; )e2e_scenario=([\w-]+)/.exec(request.headers.cookie ?? "")?.[1] ?? "ok";
    target.searchParams.set(
      "code",
      `${provider}.${scenario}.${Math.random().toString(36).slice(2)}`,
    );
    response.writeHead(302, { location: target.href });
    return response.end();
  }

  if (path === "/auth/v1/token" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)) || "{}");
    if (url.searchParams.get("grant_type") === "pkce") {
      const code = String(body.auth_code ?? "");
      if (!body.code_verifier || !new RegExp(`^(discord|google)\\.(${SCENARIOS})\\.`).test(code)) {
        return send(response, 400, {
          error_code: "flow_state_not_found",
          msg: "invalid flow state, no valid flow state found",
        });
      }
      const { provider, scenario } = partsOf(code);
      return send(response, 200, sessionFor(provider, scenario));
    }
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const [, provider, scenario] = /^refresh-(discord|google)-([\w-]+)$/.exec(
        String(body.refresh_token ?? ""),
      ) ?? [null, "google", "ok"];
      return send(response, 200, sessionFor(provider, scenario));
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
  if (path.startsWith("/auth/v1/admin/users/") && request.method === "DELETE") {
    deletedUsers.push(path.split("/").pop());
    return send(response, 200, {});
  }
  if (path === "/__deleted-users") return send(response, 200, deletedUsers);
  if (path.startsWith("/auth/v1/")) return send(response, 404, { msg: "not found" });

  // PostgREST.
  const session = sessionFromBearer(request);

  if (path.startsWith("/rest/v1/rpc/")) {
    const name = path.slice("/rest/v1/rpc/".length);
    const args = JSON.parse((await readBody(request)) || "{}");
    try {
      const result = callFunction(name, args, session);
      return result === null ? send(response, 204) : send(response, 200, result);
    } catch (failure) {
      if (failure && typeof failure === "object" && "status" in failure) {
        return send(response, failure.status, failure.body);
      }
      throw failure;
    }
  }

  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    const wantsObject = (request.headers.accept ?? "").includes("vnd.pgrst.object");

    if (request.method === "POST" && table === "announcements") {
      if (!session || !session.permissions.includes("announcement.publish")) {
        return send(response, 403, {
          code: "42501",
          message: "permission denied",
          details: null,
          hint: null,
        });
      }
      const created = newAnnouncement(JSON.parse((await readBody(request)) || "{}"), session);
      db.announcements.push(created);
      return send(response, 201, wantsObject ? created : [created]);
    }

    const rows = applyQuery(tableRows(table, session), url);
    if (!wantsObject) return send(response, 200, rows);
    return rows.length === 1
      ? send(response, 200, rows[0])
      : send(response, 406, { code: "PGRST116", message: "no rows", details: "", hint: null });
  }

  return send(response, 404, { msg: "not found" });
});

server.listen(PORT, () => process.stdout.write(`fake Supabase listening on ${PORT}\n`));
