import { Suspense } from "react";
import { adminLinksFor } from "@/features/admin/admin-links";
import { AdminNav } from "@/features/admin/admin-nav";
import { getSessionPermissions } from "@/server/session";

async function AdminSections() {
  const session = await getSessionPermissions();
  if (!session) return null;
  return <AdminNav links={adminLinksFor(session.permissions)} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Administration</h1>
      <Suspense fallback={null}>
        <AdminSections />
      </Suspense>
      {children}
    </div>
  );
}
