import { describe, expect, it } from "vitest";
import { DEVELOPERS, githubAvatarUrl, githubUrl, isGithubLogin, STACK } from "./team";
import { safeAvatarUrl } from "@/features/profile/avatar";

describe("DEVELOPERS", () => {
  it("lists valid, distinct GitHub logins", () => {
    const logins = DEVELOPERS.map((developer) => developer.github);
    expect(logins.length).toBeGreaterThan(0);
    for (const login of logins) expect(isGithubLogin(login)).toBe(true);
    expect(new Set(logins.map((login) => login.toLowerCase())).size).toBe(logins.length);
  });

  it("gives everybody a name to show", () => {
    for (const developer of DEVELOPERS) expect(developer.name.trim()).not.toBe("");
  });

  it("keeps contact details out of the page: no e-mail address anywhere", () => {
    expect(JSON.stringify([DEVELOPERS, STACK])).not.toMatch(/@\w+\.\w+/);
  });
});

describe("STACK", () => {
  it("links to https sites only", () => {
    for (const item of STACK) expect(item.url).toMatch(/^https:\/\//);
  });
});

describe("isGithubLogin", () => {
  it.each(["iSweat-exe", "a", "Ibotweat", "user-name-1"])("accepts %s", (login) => {
    expect(isGithubLogin(login)).toBe(true);
  });

  it.each(["", "-bad", "bad-", "bad--double", "has space", "a/b", "a".repeat(40), "é"])(
    "rejects %j",
    (login) => {
      expect(isGithubLogin(login)).toBe(false);
    },
  );
});

describe("githubAvatarUrl", () => {
  it("points at GitHub's avatar host, with a size", () => {
    expect(githubAvatarUrl("iSweat-exe")).toBe(
      "https://avatars.githubusercontent.com/iSweat-exe?s=96",
    );
    expect(githubAvatarUrl("iSweat-exe", 48)).toBe(
      "https://avatars.githubusercontent.com/iSweat-exe?s=48",
    );
  });

  it("escapes what should not be in a path, and stays on the host the avatar component accepts", () => {
    expect(githubAvatarUrl("a/b")).toBe("https://avatars.githubusercontent.com/a%2Fb?s=96");
    for (const developer of DEVELOPERS) {
      const url = githubAvatarUrl(developer.github);
      expect(safeAvatarUrl(url)).toBe(url);
    }
  });
});

describe("githubUrl", () => {
  it("builds the profile address and escapes what should not be there", () => {
    expect(githubUrl("iSweat-exe")).toBe("https://github.com/iSweat-exe");
    expect(githubUrl("a/b")).toBe("https://github.com/a%2Fb");
  });
});
