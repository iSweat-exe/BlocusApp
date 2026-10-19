import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventDetail } from "@/features/calendar/event-detail";
import { EventDetailSkeleton } from "@/features/calendar/event-detail-skeleton";

export const metadata: Metadata = { title: "Événement" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <EventDetail id={id} />;
}

// The page names itself with the event (its `h1`): no heading of the calendar above it.
export default function CalendarEventPage({ params }: PageProps<"/calendar/[id]">) {
  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventContent params={params} />
    </Suspense>
  );
}
