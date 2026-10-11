import Link from "next/link";

/**
 * A row that leads to `/credits`, in the style of the other links of the settings and profile screens. The page is
 * public (Guests and signed-in users alike), so this row is shown to everybody.
 */
export function CreditsLink() {
  return (
    <Link
      href="/credits"
      prefetch={false}
      className="card-link flex min-h-control items-center justify-between gap-3 px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">Crédits</span>
        <span className="block text-xs text-muted">Qui a développé BLOCUS.</span>
      </span>
      <span aria-hidden="true" className="text-faint">
        ›
      </span>
    </Link>
  );
}
