"use client";

import { useEffect } from "react";

/** Error boundary for route segments: shows a recovery UI instead of a blank page. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only the digest is logged: it lets us find the server-side log without exposing user data.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-foreground px-4 py-2 text-background"
      >
        Réessayer
      </button>
    </main>
  );
}
