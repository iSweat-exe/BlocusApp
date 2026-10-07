const DEFAULT_PATH = "/";

/**
 * Returns `next` only when it is a same-origin relative path, otherwise `/`.
 * Prevents open redirects through the OAuth `next` parameter.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return DEFAULT_PATH;
  // "//evil.com" and "/\evil.com" are interpreted as protocol-relative URLs by browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_PATH;
  if (/[\u0000-\u001f]/.test(next)) return DEFAULT_PATH;
  return next;
}
