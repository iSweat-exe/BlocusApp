import Link from "next/link";

/** Guest mode: browse the app read-only, without an account. Any write action sends back to /login. */
export function GuestLink() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Link
        href="/"
        prefetch={false}
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-foreground/15 px-4 py-3 font-medium active:bg-foreground/5"
      >
        Continuer en tant qu&apos;invité
      </Link>
      <p className="text-xs text-foreground/60">
        Consultation uniquement : actualités, calendrier et carte, sans interaction.
      </p>
    </div>
  );
}
