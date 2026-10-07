import { Suspense } from "react";
import { AnnouncementFeed } from "@/features/announcements/announcement-feed";
import { parseFeedLimit } from "@/features/announcements/feed-limit";
import { ImminentEvents } from "@/features/calendar/imminent-events";

async function Feed({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  return <AnnouncementFeed limit={parseFeedLimit(n)} />;
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-section">
      {/* Very top of the page: events that start within 30 minutes. */}
      <Suspense fallback={null}>
        <ImminentEvents />
      </Suspense>
      <h1 className="page-title">Accueil</h1>
      <Suspense fallback={<p className="text-sm text-muted">Chargement des annonces…</p>}>
        <Feed searchParams={searchParams as Promise<{ n?: string }>} />
      </Suspense>
    </div>
  );
}
