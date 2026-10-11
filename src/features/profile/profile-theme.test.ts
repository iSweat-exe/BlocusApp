import { describe, expect, it } from "vitest";
import { profileThemeOf, profileThemeStyle } from "./profile-theme";

const THEMED = "c19db495-1252-4698-af47-819c4240fd48";

describe("profileThemeOf", () => {
  it("gives the love theme to the account that has one", () => {
    expect(profileThemeOf(THEMED)?.key).toBe("love");
  });

  it("does not care about the case of the id", () => {
    expect(profileThemeOf(THEMED.toUpperCase())?.key).toBe("love");
  });

  it("gives nothing to anybody else", () => {
    expect(profileThemeOf("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(profileThemeOf("")).toBeNull();
    expect(profileThemeOf("u1")).toBeNull();
  });

  it("does not match an id that merely contains the themed one", () => {
    expect(profileThemeOf(`x${THEMED}`)).toBeNull();
    expect(profileThemeOf(`${THEMED} `)).toBeNull();
  });
});

describe("profileThemeStyle", () => {
  it("recolors the accent variables the whole app uses, with a readable text color", () => {
    const theme = profileThemeOf(THEMED)!;
    const style = profileThemeStyle(theme) as Record<string, string>;
    expect(style["--accent"]).toBe(theme.accent);
    expect(style["--accent-strong"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(style["--accent-ink"]).toBe("#ffffff");
  });
});
