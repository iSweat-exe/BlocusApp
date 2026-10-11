import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { canAccessAdmin } from "@/features/admin/access";
import { UserList } from "@/features/admin/user-list";
import { UsersSkeleton } from "@/features/admin/users-skeleton";
import { getSessionPermissions } from "@/server/session";

type AdminSearchParams = { q?: string; role?: string };

async function AdminContent({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Admin pages are hidden (404) from users without the permission; actions re-check in the database.
  if (!canAccessAdmin(session.permissions)) notFound();

  return <UserList rawParams={await searchParams} />;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Utilisateurs</h2>
        <p className="text-sm text-muted">
          Trouve un compte pour consulter sa fiche, changer son rôle ou le sanctionner.
        </p>
      </header>
      <Suspense fallback={<UsersSkeleton />}>
        <AdminContent searchParams={searchParams as Promise<AdminSearchParams>} />
      </Suspense>
    </div>
  );
}
