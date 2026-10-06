"use client";

/** Last-resort error boundary (errors thrown in the root layout). Must render its own html/body. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Une erreur est survenue</h1>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
