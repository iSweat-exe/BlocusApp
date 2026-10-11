import { describe, expect, it } from "vitest";
import { countryFlag, countryName, isCountryCode } from "./country";

describe("isCountryCode", () => {
  it("accepts two capital letters only", () => {
    expect(isCountryCode("FR")).toBe(true);
    expect(isCountryCode("fr")).toBe(false);
    expect(isCountryCode("FRA")).toBe(false);
    expect(isCountryCode("")).toBe(false);
  });
});

describe("countryName", () => {
  it("names the country in French", () => {
    expect(countryName("FR")).toBe("France");
    expect(countryName("BE")).toBe("Belgique");
  });

  it("falls back to the input when it is not a country code", () => {
    expect(countryName("france")).toBe("france");
    expect(countryName("")).toBe("");
  });
});

describe("countryFlag", () => {
  it("builds the flag from the two letters", () => {
    expect(countryFlag("FR")).toBe("\u{1F1EB}\u{1F1F7}");
    expect(countryFlag("BE")).toBe("\u{1F1E7}\u{1F1EA}");
  });

  it("returns nothing for an invalid code", () => {
    expect(countryFlag("fr")).toBe("");
    expect(countryFlag("USA")).toBe("");
  });
});
