import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";
import { GoogleButton } from "@/features/auth/google-button";
import { GuestLink } from "@/features/auth/guest-link";
import { LoginBackground } from "@/features/auth/login-background";
import { LoginError } from "@/features/auth/login-error";
import { LynxLogo } from "@/features/auth/lynx-logo";

export default function LoginPage() {
  return (
    <>
      <LoginBackground />

      <div className="relative z-10 mx-auto flex h-dvh max-h-dvh w-full max-w-[440px] flex-col justify-between overflow-hidden font-syne px-5 pt-[max(20px,env(safe-area-inset-top))] pb-5">
        <header className="mt-[clamp(40px,8vh,72px)] mb-5 text-center">
          <h1 className="sr-only">Connexion</h1>

          <p
            className="mb-1 font-syne text-[clamp(2.4rem,7vw,3rem)] font-bold tracking-[-0.04em] text-foreground"
            aria-hidden="true"
          >
            BLOCUS<span className="text-accent">.</span>
          </p>
          <p className="text-[0.9rem] font-medium text-muted">Toutes les infos en direct</p>
        </header>

        <Suspense>
          <LoginError />
        </Suspense>

        <div className="my-auto flex flex-col gap-2.5">
          <DiscordButton />
          <GoogleButton />

          <div className="my-0.5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-faint">
            <span className="h-px flex-1 bg-foreground/15" />
            ou
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          <GuestLink />
        </div>

        <LynxLogo />
      </div>
    </>
  );
}
