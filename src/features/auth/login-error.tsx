"use client";

import { useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  oauth_start: "Impossible de démarrer la connexion Discord. Réessaie.",
  oauth_callback: "La connexion a échoué. Réessaie.",
};

/**
 * Message shown on `/login?error=…` after a failed OAuth round trip. It reads the query string in the browser
 * (instead of `searchParams` on the server) so that the login page itself stays fully static: it is then served
 * by the CDN with no function invocation. Wrap in `<Suspense>`.
 */
export function LoginError() {
  const error = useSearchParams().get("error");
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="alert alert-error">
      {message}
    </p>
  );
}
