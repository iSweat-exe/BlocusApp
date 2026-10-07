import Image from "next/image";
import Link from "next/link";
import { canAccessAdmin } from "@/features/admin/access";
import { safeAvatarUrl } from "@/features/profile/avatar";
import { getSessionPermissions } from "@/server/session";
import { HeaderIconLink } from "./header-icon-link";
import { ShieldIcon, UserIcon } from "./icons";

/** Placeholder with the header's height, shown while the session is read (no layout shift). */
export function AppHeaderFallback() {
  return <div aria-hidden="true" className="h-14" />;
}

/**
 * Top bar of the app: brand on the left; on the right the Administration shortcut (only with an admin
 * permission) and the profile button (Discord avatar when available). Guests get a "Se connecter" button.
 * Sign-out lives on the profile page. Reads cookies: wrap in Suspense.
 */
export async function AppHeader() {
  const session = await getSessionPermissions();
  const avatar = safeAvatarUrl(session?.avatarUrl);

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          prefetch={false}
          className="flex min-h-11 items-center gap-2 text-base font-bold tracking-tight"
        >
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={28}
            height={28}
            unoptimized
            className="rounded-lg"
          />
          BlocusApp
        </Link>

        <nav aria-label="Compte" className="flex items-center gap-2">
          {!session ? (
            <Link
              href="/login"
              prefetch={false}
              className="flex h-11 items-center rounded-full bg-red-500 px-5 text-sm font-semibold text-white active:bg-red-600"
            >
              Se connecter
            </Link>
          ) : (
            <>
              {canAccessAdmin(session.permissions) && (
                <HeaderIconLink href="/admin" label="Administration">
                  <ShieldIcon />
                </HeaderIconLink>
              )}
              <HeaderIconLink href="/profil" label="Mon profil">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <UserIcon />
                )}
              </HeaderIconLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
