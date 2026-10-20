import Link from "next/link";

/**
 * A row that leads to `/patch-notes`, in the style of the other links of the settings. The page is public (Guests
 * and signed-in users alike), so this row is shown to everybody.
 */
export function PatchNotesLink() {
  return (
    <Link
      href="/patch-notes"
      prefetch={false}
      className="card-link flex min-h-control items-center justify-between gap-3 px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">Patch notes</span>
        <span className="block text-xs text-muted">Historique des modifications.</span>
      </span>
      <span aria-hidden="true" className="text-faint">
        ›
      </span>
    </Link>
  );
}
