import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { RoleMatrix } from "@/features/admin/role-matrix";
import { getSessionPermissions } from "@/server/session";

async function RolesContent() {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Hidden (404) without the permission; the actions re-check in the database.
  if (!session.permissions.includes("permission.manage")) notFound();
  return <RoleMatrix session={session} />;
}

export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-section">
      <h2 className="text-xl font-semibold tracking-tight">Rôles et permissions</h2>
      <p className="text-sm text-muted">
        Choisis ce que peut faire chaque rôle. Tu modifies uniquement les rôles en dessous du tien,
        et tu n&apos;accordes que ce que tu possèdes.
      </p>
      <Suspense fallback={<p className="text-sm text-muted">Chargement…</p>}>
        <RolesContent />
      </Suspense>
    </div>
  );
}
