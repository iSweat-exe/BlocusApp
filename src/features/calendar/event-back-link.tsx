import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * "‹ Calendrier" at the top of an event page: back to the calendar, on the day of the event when `href` says so.
 * A 44 px touch area, pulled back by its own padding so the chevron lines up with the page edge.
 */
export function EventBackLink({ href = "/calendar" }: { href?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="-ml-2 inline-flex min-h-tap items-center gap-0.5 self-start rounded-control pr-3 pl-1 text-sm font-medium text-muted transition-[scale,color] active:scale-[0.96] [@media(hover:hover)]:hover:text-foreground"
    >
      <ChevronLeftIcon className="size-5" />
      Calendrier
    </Link>
  );
}
