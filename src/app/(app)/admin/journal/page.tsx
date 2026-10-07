import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { parseJournalParams } from "@/features/admin/audit";
import { JournalView } from "@/features/admin/journal-view";
import { getSessionPermissions } from "@/server/session";

async function JournalContent({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; before?: string }>;
}) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; RLS also returns nothing to users lacking audit.read.
  if (!session.permissions.includes("audit.read")) notFound();

  return <JournalView params={parseJournalParams(await searchParams)} />;
}

export default function AdminJournalPage({ searchParams }: PageProps<"/admin/journal">) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Journal d&apos;audit</h2>
      <p className="text-sm text-foreground/60">
        Historique des actions d&apos;administration : changements de rôle, permissions, bans.
      </p>
      <Suspense fallback={<p className="text-sm text-foreground/60">Chargement…</p>}>
        <JournalContent
          searchParams={searchParams as Promise<{ action?: string; before?: string }>}
        />
      </Suspense>
    </div>
  );
}
