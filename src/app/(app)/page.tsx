import { Suspense } from "react";
import { AnnouncementFeed } from "@/features/announcements/announcement-feed";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Accueil</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Chargement des annonces…</p>}>
        <AnnouncementFeed />
      </Suspense>
    </div>
  );
}
