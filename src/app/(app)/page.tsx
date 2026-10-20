import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementFeed } from "@/features/announcements/announcement-feed";
import { parseFeedLimit } from "@/features/announcements/feed-limit";
import { ImminentEvents } from "@/features/calendar/imminent-events";
import { UpcomingEvents } from "@/features/calendar/upcoming-events";

export const metadata: Metadata = { title: "Accueil" };

async function Feed({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  return <AnnouncementFeed limit={parseFeedLimit(n)} />;
}

// A phone shows the news. From 1024 px a panel with the next events sits beside them (it stays in view while the
// feed scrolls): what is coming is one glance away, without leaving the page.
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-section">
        {/* Very top of the page: events that start within 30 minutes. */}
        <Suspense fallback={null}>
          <ImminentEvents />
        </Suspense>
        <h1 className="page-title">Accueil</h1>
        <Suspense fallback={<p className="text-sm text-muted">Chargement des annonces…</p>}>
          <Feed searchParams={searchParams as Promise<{ n?: string }>} />
        </Suspense>
      </div>

      <aside aria-label="Événements à venir" className="hidden lg:sticky lg:top-24 lg:block">
        <Suspense fallback={null}>
          <UpcomingEvents />
        </Suspense>
      </aside>
    </div>
  );
}
