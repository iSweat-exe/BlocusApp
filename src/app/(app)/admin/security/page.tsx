import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SecurityPanel } from "@/features/mfa/security-panel";
import { getSessionPermissions } from "@/server/session";

async function SecurityContent() {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission (super administrators only); the database re-checks on every change.
  if (!session.permissions.includes("security.manage")) notFound();
  return <SecurityPanel />;
}

export default function AdminSecurityPage() {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Sécurité</h2>
        <p className="text-sm text-muted">Réglages de sécurité de l&apos;application.</p>
      </header>
      <Suspense fallback={<div className="card h-40" aria-hidden="true" />}>
        <SecurityContent />
      </Suspense>
    </div>
  );
}
