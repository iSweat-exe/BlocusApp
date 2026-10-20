import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";
import { GoogleButton } from "@/features/auth/google-button";
import { GuestLink } from "@/features/auth/guest-link";
import { LoginBackground } from "@/features/auth/login-background";
import { LoginError } from "@/features/auth/login-error";
import { MemberCount } from "@/features/auth/member-count";
import { LegalConsentNote } from "@/features/legal/legal-links";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <>
      <LoginBackground />

      {/* `min-h-dvh` and no fixed height: on a short screen (landscape, large system font) the page scrolls. */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-safe-top pb-safe-bottom lg:my-12 lg:min-h-0 lg:rounded-sheet lg:border lg:border-line lg:bg-background/85 lg:px-10 lg:py-10 lg:shadow-xl lg:backdrop-blur-md">
        <header className="mt-10 mb-5 text-center sm:mt-16 lg:mt-0">
          <h1 className="sr-only">Connexion</h1>

          <p
            className="mb-1 font-display text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl"
            aria-hidden="true"
          >
            BLOCUS<span className="text-accent">.</span>
          </p>
          <p className="text-sm font-medium text-muted">Toutes les infos en direct</p>
        </header>

        <Suspense>
          <LoginError />
        </Suspense>

        <div className="my-auto flex flex-col gap-2.5 py-6">
          <DiscordButton />
          <GoogleButton />

          <div className="my-0.5 flex items-center gap-3 text-xs font-semibold tracking-wider text-faint uppercase">
            <span className="h-px flex-1 bg-foreground/15" />
            ou
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          <GuestLink />

          <LegalConsentNote />
        </div>

        <footer className="flex flex-col items-center pb-2 text-center">
          <Suspense>
            <MemberCount />
          </Suspense>
          {/* Discreet on purpose: easy to find for the curious, never in the way of the sign-in buttons. */}
          <Link
            href="/credits"
            prefetch={false}
            className="inline-flex min-h-tap items-center px-3 text-xs text-faint underline-offset-2 [@media(hover:hover)]:hover:underline"
          >
            Crédits
          </Link>
          <Link
            href="/confidentialite"
            prefetch={false}
            className="inline-flex min-h-tap items-center px-3 text-xs text-faint underline-offset-2 [@media(hover:hover)]:hover:underline"
          >
            Confidentialité
          </Link>
        </footer>
      </div>
    </>
  );
}
