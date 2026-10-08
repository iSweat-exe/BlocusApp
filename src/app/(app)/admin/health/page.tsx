import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HealthView } from "@/features/health/health-view";
import { requirePermission } from "@/server/require-permission";
import { getSessionPermissions } from "@/server/session";

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
      <h2 className="text-xl font-semibold tracking-tight">Santé de l&apos;application</h2>
      <p className="text-sm text-muted">
        État de la base de données, de l&apos;authentification et du déploiement, avec
        l&apos;historique du score.
      </p>
      <Suspense fallback={<p className="text-sm text-muted">Mesure en cours…</p>}>
        <HealthContent />
      </Suspense>
    </div>
  );
}
