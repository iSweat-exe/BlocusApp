/**
 * "Continue with Discord" button. A plain `<a>` (not `next/link`, which would prefetch it and start an
 * OAuth flow) pointing at the GET route that redirects to Discord: no JavaScript needed.
 */
export function DiscordButton() {
  return (
    <a
      href="/auth/login/discord"
      className="block w-full rounded-lg bg-[#5865F2] px-4 py-3 text-center font-medium text-white"
    >
      Continuer avec Discord
    </a>
  );
}
