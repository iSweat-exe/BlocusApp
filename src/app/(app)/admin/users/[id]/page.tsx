import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { canAccessAdmin } from "@/features/admin/access";
import { UserDetail } from "@/features/admin/user-detail";
import { getSessionPermissions } from "@/server/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function UserContent({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  if (!canAccessAdmin(session.permissions)) notFound();

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <UserDetail id={id} session={session} />;
}

export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Chargement…</p>}>
        <UserContent params={params} />
      </Suspense>
    </div>
  );
}
