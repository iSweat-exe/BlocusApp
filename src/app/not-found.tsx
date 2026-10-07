import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="page-title">Page introuvable</h1>
      <Link href="/" className="btn btn-secondary">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
