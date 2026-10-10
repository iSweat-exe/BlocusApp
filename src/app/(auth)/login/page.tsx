import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";
import { GoogleButton } from "@/features/auth/google-button";
import { GuestLink } from "@/features/auth/guest-link";
import { LoginBackground } from "@/features/auth/login-background";
import { LoginError } from "@/features/auth/login-error";

export default function LoginPage() {
  return (
    <>
      <LoginBackground />

      {/* `min-h-dvh` and no fixed height: on a short screen (landscape, large system font) the page scrolls. */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-safe-top pb-safe-bottom font-syne">
        <header className="mt-10 mb-5 text-center sm:mt-16">
          <h1 className="sr-only">Connexion</h1>

          <p
            className="mb-1 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl"
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
        </div>
      </div>
    </>
  );
}
