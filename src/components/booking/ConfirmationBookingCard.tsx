import { useMemo } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";
import { AddToCalendarMenu } from "./AddToCalendarMenu";
import {
  attendeeName,
  bookingTitle,
  calendarEventFor,
  planLabelFor,
  venueLine,
  whenLine,
  type ConfirmationBooking,
} from "./confirmationBooking";

interface ConfirmationBookingCardProps {
  booking: ConfirmationBooking;
  /** Position in the list, for a small entrance stagger. */
  index?: number;
  className?: string;
}

/**
 * One booking on the confirmation: what, for whom, when, where — and a way
 * to put it in the family calendar. Reads like a ticket, not a table row.
 */
export function ConfirmationBookingCard({ booking, index = 0, className }: ConfirmationBookingCardProps) {
  const attendee = attendeeName(booking);
  const when = whenLine(booking);
  const where = venueLine(booking);
  const event = useMemo(() => calendarEventFor(booking), [booking]);

  return (
    <article
      className={cn("surface animate-rise-in p-5", className)}
      style={{ animationDelay: `${120 + index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">{bookingTitle(booking)}</h2>
          {attendee && <p className="mt-0.5 text-[15px] text-foreground">{attendee}</p>}
          <p className="mt-0.5 text-[13px] text-muted-foreground">{planLabelFor(booking)}</p>
        </div>
        {booking.amount != null && (
          <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">{formatPrice(booking.amount)}</p>
        )}
      </div>

      {(when || where) && (
        <ul className="mt-4 space-y-2 text-[15px] leading-snug text-foreground">
          {when && (
            <li className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{when}</span>
            </li>
          )}
          {where && (
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{where}</span>
            </li>
          )}
        </ul>
      )}

      {event && (
        <div className="mt-5 border-t border-border pt-4">
          <AddToCalendarMenu event={event} />
        </div>
      )}
    </article>
  );
}

export default ConfirmationBookingCard;
