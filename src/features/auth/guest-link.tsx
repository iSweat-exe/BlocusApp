import Link from "next/link";

/** Guest mode: browse the app read-only, without an account. Any write action sends back to /login. */
export function GuestLink() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Link href="/" prefetch={false} className="btn btn-outline w-full">
        Continuer en tant qu&apos;invité
      </Link>
      <p className="text-xs text-muted">
        Consultation uniquement : actualités, calendrier et carte, sans interaction.
      </p>
    </div>
  );
}
