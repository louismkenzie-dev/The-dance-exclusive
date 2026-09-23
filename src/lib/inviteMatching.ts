// Which booking, if any, a payment link has turned into.
//
// A link names its own dates ("Avier, Hip Hop, Mon 21 Sep, £10"). The only
// booking that can mean it's been paid is one for that family, on that
// class, FOR ONE OF THOSE DATES. Anything else the family has on the class —
// a night they paid for three weeks ago, a place the studio added by hand —
// is a different thing, and matching it made the tab say "Paid" the instant
// Amie pressed the button, and pointed Refund at the wrong payment.
//
// Links without dates (a monthly or termly plan, a private class's whole
// run) keep the wider match: any live booking that family has on the class.

export interface InviteLike {
  status: string;
  session_dates?: string[] | null;
}

export interface BookingLike {
  status: string;
  notes?: string | null;
}

export const bookedDateOf = (notes: string | null | undefined): string | null =>
  /session (\d{4}-\d{2}-\d{2})/.exec(notes ?? "")?.[1] ?? null;

/**
 * `familyBookings` are the family's non-cancelled bookings on the link's
 * class, already narrowed to parent + student. Returns the one this link
 * produced, preferring a confirmed booking over one still awaiting payment.
 */
export function bookingForInvite<B extends BookingLike>(
  invite: InviteLike,
  familyBookings: B[],
): B | undefined {
  const dates = invite.session_dates?.length ? new Set(invite.session_dates) : null;
  const candidates = dates
    ? familyBookings.filter((b) => {
        const d = bookedDateOf(b.notes);
        return d != null && dates.has(d);
      })
    : familyBookings;
  return candidates.find((b) => b.status === "confirmed") ?? candidates[0];
}

/** Paid means fulfilment spent the link, or its own booking is confirmed. */
export function inviteIsPaid<B extends BookingLike>(invite: InviteLike, familyBookings: B[]): boolean {
  if (invite.status === "accepted") return true;
  return bookingForInvite(invite, familyBookings)?.status === "confirmed";
}

/**
 * Does this family already hold the place an invite is offering?
 *
 * The parent's own My Bookings asks this to decide whether to still show the
 * "Confirm and pay" card, and it must be asked per date. Asking it per class
 * is what hid Kirsty McAlpine's £10 link for 16 September: her pass covered
 * other nights on the same class, so the one night she still owed for
 * vanished from her account while the studio could see it plainly.
 *
 * `familyBookings` must already be narrowed to live bookings (confirmed or
 * awaiting payment) for this parent, this class and this dancer.
 */
export function inviteAlreadyHeld<B extends BookingLike>(
  invite: InviteLike,
  familyBookings: B[],
): boolean {
  return bookingForInvite(invite, familyBookings) !== undefined;
}
