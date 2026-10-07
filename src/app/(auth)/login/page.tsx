import { Suspense } from "react";
import { DiscordButton } from "@/features/auth/discord-button";

const ERRORS: Record<string, string> = {
  oauth_start: "Impossible de démarrer la connexion Discord. Réessaie.",
  oauth_callback: "La connexion a échoué. Réessaie.",
};

async function LoginError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-500">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <Suspense>
        <LoginError searchParams={searchParams as Promise<{ error?: string }>} />
      </Suspense>
      <DiscordButton />
    </div>
  );
}
