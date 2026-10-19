import Link from "next/link";
import { LEGAL_PAGES } from "./legal-info";

/**
 * The legal pages as rows, in the style of the other links of the settings. The pages are public (Guests and
 * signed-in users alike), so these rows are shown to everybody.
 */
export function LegalLinks() {
  return (
    <div className="card flex flex-col overflow-hidden">
      {LEGAL_PAGES.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          prefetch={false}
          className="flex min-h-control items-center justify-between gap-3 px-4 py-3 text-sm font-medium active:bg-foreground/10 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line"
        >
          {page.label}
          <span aria-hidden="true" className="text-faint">
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The sentence under the sign-in buttons: signing in means accepting the terms and the privacy policy. There is no
 * checkbox on purpose (no extra step before signing in); the links are one tap away.
 */
export function LegalConsentNote() {
  return (
    <p className="text-center text-xs text-muted">
      En continuant, tu acceptes les{" "}
      <Link href="/cgu" prefetch={false} className="font-medium underline underline-offset-2">
        conditions d&apos;utilisation
      </Link>{" "}
      et la{" "}
      <Link
        href="/confidentialite"
        prefetch={false}
        className="font-medium underline underline-offset-2"
      >
        politique de confidentialité
      </Link>
      .
    </p>
  );
}
