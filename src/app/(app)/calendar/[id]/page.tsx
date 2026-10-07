import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventDetail } from "@/features/calendar/event-detail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <EventDetail id={id} />;
}

export default function CalendarEventPage({ params }: PageProps<"/calendar/[id]">) {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Calendrier</h1>
      <Suspense fallback={<p className="text-sm text-muted">Chargement…</p>}>
        <EventContent params={params} />
      </Suspense>
    </div>
  );
}
