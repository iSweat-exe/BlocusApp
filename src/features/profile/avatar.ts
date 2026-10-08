/** Hosts allowed to serve avatars (must match `img-src` in `next.config.ts`). */
const AVATAR_HOSTS = new Set(["cdn.discordapp.com", "lh3.googleusercontent.com"]);

/**
 * Returns the avatar URL only when it is an https URL on an allowed host, otherwise `null`.
 * `profiles.avatar_url` is user-editable, so it is never rendered blindly.
 */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && AVATAR_HOSTS.has(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Up to two uppercase initials of a pseudo, used when there is no avatar. */
export function initialsOf(pseudo: string): string {
  const parts = pseudo.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]) : [(parts[0] ?? "?").slice(0, 2)];
  return letters.join("").toUpperCase();
}
