import Link from "next/link";

/** 404: a short, light page that always leaves a way out (home, or the map for those who came for it). */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-gutter text-center">
      <p
        aria-hidden="true"
        className="flex items-center font-display text-7xl font-extrabold tracking-tighter sm:text-8xl"
      >
        404
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="page-title">Page introuvable</h1>
        <p className="mx-auto max-w-xs text-sm text-muted">
          Cette page s&apos;est perdue dans le cortège : elle a du prendre une autre rue. (jpp de
          dev cette app -iSweat)
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link href="/" prefetch={false} className="btn btn-primary">
          Retour à l&apos;accueil
        </Link>
        <Link href="/map" prefetch={false} className="btn btn-outline">
          Voir la carte
        </Link>
      </div>
    </main>
  );
}
