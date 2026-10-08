import Image from "next/image";
import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";
import { LoginError } from "@/features/auth/login-error";
import { GoogleButton } from "@/features/auth/google-button";
import { GuestLink } from "@/features/auth/guest-link";

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          unoptimized
          priority
          className="rounded-card shadow-sm"
        />
        <h1 className="page-title">Connexion</h1>
        <p className="text-sm text-muted">Connecte-toi pour accéder à BlocusApp.</p>
      </header>

      <Suspense>
        <LoginError />
      </Suspense>

      <div className="flex flex-col gap-3">
        <DiscordButton />
        <GoogleButton />
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-faint">
        <span className="h-px flex-1 bg-foreground/15" />
        ou
        <span className="h-px flex-1 bg-foreground/15" />
      </div>

      <GuestLink />
    </div>
  );
}
