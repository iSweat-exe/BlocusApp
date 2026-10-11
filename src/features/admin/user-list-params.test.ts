import { describe, expect, it } from "vitest";
import { parseUserListParams, userListHref } from "./user-list-params";

const ROLES = ["user", "moderator", "admin"];

describe("parseUserListParams", () => {
  it("keeps a trimmed search and a role that exists", () => {
    expect(parseUserListParams({ q: "  lynx ", role: "moderator" }, ROLES)).toEqual({
      search: "lynx",
      role: "moderator",
    });
  });

  it("cuts a search at the length the database layer accepts", () => {
    expect(parseUserListParams({ q: "a".repeat(80) }, ROLES).search).toHaveLength(32);
  });

  it.each([
    [{ q: 42, role: ["admin"] }],
    [{ q: undefined, role: "root" }],
    [{ role: "constructor" }],
    [{}],
  ])("ignores invalid values (%j)", (raw) => {
    expect(parseUserListParams(raw, ROLES)).toEqual({ search: "", role: null });
  });
});

describe("userListHref", () => {
  it("builds the URL with only what is set, and encodes the search", () => {
    expect(userListHref({})).toBe("/admin");
    expect(userListHref({ role: "admin" })).toBe("/admin?role=admin");
    expect(userListHref({ search: "a b&c" })).toBe("/admin?q=a+b%26c");
    expect(userListHref({ search: "lynx", role: "admin" })).toBe("/admin?q=lynx&role=admin");
  });
});
