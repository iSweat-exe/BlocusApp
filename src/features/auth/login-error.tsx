"use client";

import { useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  oauth_start: "Impossible de démarrer la connexion. Réessaie.",
  oauth_callback: "La connexion a échoué. Réessaie.",
  email_not_verified:
    "Email non vérifié. Vérifie l'adresse e-mail de ton compte Discord ou Google, puis réessaie.",
};

/**
 * Message shown on `/login?error=…` after a failed OAuth round trip. It reads the query string in the browser
 * (instead of `searchParams` on the server) so that the login page itself stays fully static: it is then served
 * by the CDN with no function invocation. Wrap in `<Suspense>`.
 */
export function LoginError() {
  const params = useSearchParams();
  // After the deletion of an account (`/login?deleted=1`): a confirmation, not an error.
  if (params.get("deleted") === "1") {
    return (
      <p role="status" className="alert border-success/30 bg-success/10 text-success">
        Ton compte a été supprimé. À bientôt.
      </p>
    );
  }
  const error = params.get("error");
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="alert alert-error">
      {message}
    </p>
  );
}
