import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/features/profile/profile-view";
import { getSessionPermissions } from "@/server/session";

async function ProfileContent() {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  return <ProfileView session={session} />;
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Mon profil</h1>
      <Suspense fallback={<p className="text-sm text-muted">Chargement…</p>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
