import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { parseJournalParams } from "@/features/admin/audit";
import { JournalSkeleton } from "@/features/admin/journal-skeleton";
import { JournalView } from "@/features/admin/journal-view";
import { getSessionPermissions } from "@/server/session";

export const metadata: Metadata = { title: "Journal d'audit" };

type JournalSearchParams = { category?: string; action?: string; before?: string };

async function JournalContent({ searchParams }: { searchParams: Promise<JournalSearchParams> }) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; RLS also returns nothing to users lacking audit.read.
  if (!session.permissions.includes("audit.read")) notFound();

  return <JournalView params={parseJournalParams(await searchParams)} />;
}

export default function AdminJournalPage({ searchParams }: PageProps<"/admin/journal">) {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Journal d&apos;audit</h2>
        <p className="text-sm text-muted">
          Qui a fait quoi, et quand : rôles, permissions, sanctions, calendrier et carte.
        </p>
      </header>
      <Suspense fallback={<JournalSkeleton />}>
        <JournalContent searchParams={searchParams as Promise<JournalSearchParams>} />
      </Suspense>
    </div>
  );
}
