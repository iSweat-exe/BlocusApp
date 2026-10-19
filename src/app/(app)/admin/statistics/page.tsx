import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { parsePeriod } from "@/features/statistics/periods";
import { StatisticsSkeleton } from "@/features/statistics/statistics-skeleton";
import { StatisticsView } from "@/features/statistics/statistics-view";
import { requirePermission } from "@/server/require-permission";
import { getSessionPermissions } from "@/server/session";

export const metadata: Metadata = { title: "Statistiques" };

type StatisticsSearchParams = { period?: string | string[] };

async function StatisticsContent({
  searchParams,
}: {
  searchParams: Promise<StatisticsSearchParams>;
}) {
  // The figures depend on the current time: never part of the static shell.
  await connection();
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; the database functions check `statistics.view` again.
  if (!session.permissions.includes("statistics.view")) notFound();
  if (!(await requirePermission("statistics.view")).ok) notFound();

  return <StatisticsView period={parsePeriod((await searchParams).period)} />;
}

export default function AdminStatisticsPage({ searchParams }: PageProps<"/admin/statistics">) {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Statistiques</h2>
        <p className="text-sm text-muted">
          Inscriptions, activité heure par heure, heures de pointe et répartition des comptes.
        </p>
      </header>
      <Suspense fallback={<StatisticsSkeleton />}>
        <StatisticsContent searchParams={searchParams as Promise<StatisticsSearchParams>} />
      </Suspense>
    </div>
  );
}
