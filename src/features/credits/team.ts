/** A person who develops the application. */
export type Developer = {
  /** GitHub login: the link and the address shown come from it. */
  github: string;
  /** Name shown first; the login when the person has no other name. */
  name: string;
};

/**
 * Everyone who develops the application, in the order they appear on `/credits`. To add someone, add a line here:
 * nothing else to change. Only public GitHub logins live here (no e-mail address, no other contact).
 */
export const DEVELOPERS: readonly Developer[] = [
  { github: "iSweat-exe", name: "iSweat" },
  { github: "Ibotweat", name: "Ibotweat" },
];

/** The public repository whose contributor statistics (commits, added and deleted lines) the credits show. */
export const GITHUB_REPOSITORY = "iSweat-exe/BlocusApp";

/** What the application is built with, shown under the team. */
export const STACK: readonly { name: string; url: string }[] = [
  { name: "Next.js", url: "https://nextjs.org" },
  { name: "React", url: "https://react.dev" },
  { name: "Supabase", url: "https://supabase.com" },
  { name: "MapLibre", url: "https://maplibre.org" },
  { name: "OpenFreeMap", url: "https://openfreemap.org" },
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright" },
];

/** Whether a string is a valid GitHub login (letters, digits and single hyphens, 1 to 39 characters). */
export function isGithubLogin(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(value);
}

/**
 * Address of the public profile photo of a GitHub account, `size` pixels wide. Served by GitHub's avatar host (the
 * only one the CSP allows for it) directly, without the redirect that `github.com/<login>.png` goes through.
 */
export function githubAvatarUrl(login: string, size = 96): string {
  return `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=${size}`;
}

/** Address of a GitHub profile. */
export function githubUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}`;
}
