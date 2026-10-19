import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HealthSkeleton } from "@/features/health/health-skeleton";
import { HealthView } from "@/features/health/health-view";
import { requirePermission } from "@/server/require-permission";
import { getSessionPermissions } from "@/server/session";

export const metadata: Metadata = { title: "Santé de l'application" };

async function HealthContent() {
  // The measures read the clock and the network on every visit: never part of the static shell.
  await connection();
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; the database functions check `monitoring.view` again.
  if (!session.permissions.includes("monitoring.view")) notFound();
  if (!(await requirePermission("monitoring.view")).ok) notFound();

  return <HealthView />;
}

export default function AdminHealthPage() {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Santé de l&apos;application</h2>
        <p className="text-sm text-muted">
          État de la base de données, de l&apos;authentification et du déploiement, avec
          l&apos;historique du score.
        </p>
      </header>
      <Suspense fallback={<HealthSkeleton />}>
        <HealthContent />
      </Suspense>
    </div>
  );
}
