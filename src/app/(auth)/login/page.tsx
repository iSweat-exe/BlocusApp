import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";
import { LoginError } from "@/features/auth/login-error";
import { GoogleButton } from "@/features/auth/google-button";
import { GuestLink } from "@/features/auth/guest-link";
import { LynxLogo } from "@/features/auth/lynx-logo";

export default function LoginPage() {
  return (
    <div className="flex w-full flex-col justify-between flex-1 font-syne z-10">
      <header className="text-center mt-[clamp(40px,8vh,72px)] mb-[20px]">
        <h1 className="font-syne text-[clamp(2.4rem,7vw,3rem)] font-bold tracking-[-0.04em] text-foreground mb-[4px]">
          BLOCUS<span className="text-accent">.</span>
        </h1>
        <p className="text-[0.9rem] font-medium text-muted">Toutes les infos en direct</p>
      </header>

      <Suspense>
        <LoginError />
      </Suspense>

      <div className="flex flex-col gap-3 my-auto">
        <DiscordButton />
        <GoogleButton />

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-faint my-1">
          <span className="h-px flex-1 bg-foreground/15" />
          ou
          <span className="h-px flex-1 bg-foreground/15" />
        </div>

        <GuestLink />
      </div>

      {/* Logo Lynx SVG original Blocus */}
      <LynxLogo />
    </div>
  );
}
