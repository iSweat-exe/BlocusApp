const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });

/** Whether `code` looks like an ISO 3166-1 alpha-2 country code in capitals (`FR`). */
export function isCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

/**
 * Name of a country in French (`FR` gives `France`). Falls back to the code itself when it is not a valid code
 * or the runtime does not know it.
 */
export function countryName(code: string): string {
  if (!isCountryCode(code)) return code;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Flag emoji of a country (`FR` gives the French flag), built from two regional indicator letters. Empty for
 * anything that is not a country code. Some systems (Windows) draw the two letters instead of a flag.
 */
export function countryFlag(code: string): string {
  if (!isCountryCode(code)) return "";
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}
