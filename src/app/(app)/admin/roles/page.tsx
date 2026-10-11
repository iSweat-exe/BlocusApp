import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { RoleMatrix } from "@/features/admin/role-matrix";
import { RolesSkeleton } from "@/features/admin/roles-skeleton";
import { getSessionPermissions } from "@/server/session";

async function RolesContent({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; the actions re-check in the database.
  if (!session.permissions.includes("permission.manage")) notFound();

  const { role } = await searchParams;
  // An unknown or repeated value is ignored by the model, which then opens the default role.
  return (
    <RoleMatrix session={session} requestedRole={typeof role === "string" ? role : undefined} />
  );
}

export default function AdminRolesPage({ searchParams }: PageProps<"/admin/roles">) {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Rôles et permissions</h2>
        <p className="text-sm text-muted">
          Choisis un rôle, puis ce qu&apos;il a le droit de faire.
        </p>
      </header>
      <Suspense fallback={<RolesSkeleton />}>
        <RolesContent searchParams={searchParams as Promise<{ role?: string }>} />
      </Suspense>
    </div>
  );
}
