/**
 * "Continue with Google" button. Disabled for now: Google sign-in is not wired yet (A-021). A real
 * `<button disabled>` (not a dead link) so it is skipped by keyboard and announced as unavailable.
 */
export function GoogleButton() {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-3 font-medium opacity-50"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          fill="#4285F4"
          d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.9a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.3Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.83 14.08a6.6 6.6 0 0 1 0-4.16V7.08H2.17a11 11 0 0 0 0 9.84l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.37c1.62 0 3.06.56 4.21 1.65l3.15-3.15A10.57 10.57 0 0 0 12 1 11 11 0 0 0 2.17 7.08l3.66 2.84C6.7 7.31 9.13 5.37 12 5.37Z"
        />
      </svg>
      Continuer avec Google
      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-normal">Bientôt</span>
    </button>
  );
}
