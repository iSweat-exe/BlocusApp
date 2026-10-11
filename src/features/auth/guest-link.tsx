import Link from "next/link";
import { EyeIcon } from "@/components/icons";

/** Guest mode: browse the app read-only, without an account. Any write action sends back to /login. */
export function GuestLink() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Link href="/" prefetch={false} className="btn btn-outline w-full gap-3">
        <EyeIcon className="h-5 w-5" />
        Continuer en tant qu&apos;invité
      </Link>
      <p className="text-xs text-muted">
        Consultation uniquement : actualités, calendrier et carte, sans interaction.
      </p>
    </div>
  );
}
