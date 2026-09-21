import { describe, expect, it } from "vitest";
import { bookingForInvite, inviteIsPaid } from "./inviteMatching";

// Avier Jackson, 21 Sep: a link for tonight, and a night he paid for in August.
const AVIER = [
  { id: "old", status: "confirmed", notes: "Stripe PaymentIntent: pi_3UA4y6 | session 2026-09-07" },
];
const LINK_TONIGHT = { status: "pending", session_dates: ["2026-09-21"] };

describe("bookingForInvite", () => {
  it("a dated link is not paid by a booking for a different night", () => {
    expect(bookingForInvite(LINK_TONIGHT, AVIER)).toBeUndefined();
    expect(inviteIsPaid(LINK_TONIGHT, AVIER)).toBe(false);
  });

  it("a dated link is paid by the booking for its own night", () => {
    const paid = [...AVIER, { id: "new", status: "confirmed", notes: "Stripe PaymentIntent: pi_new | session 2026-09-21" }];
    expect(bookingForInvite(LINK_TONIGHT, paid)?.id).toBe("new");
    expect(inviteIsPaid(LINK_TONIGHT, paid)).toBe(true);
  });

  it("a link for several dates matches any of them, confirmed first", () => {
    const link = { status: "pending", session_dates: ["2026-09-22", "2026-09-29"] };
    const bookings = [
      { id: "p", status: "pending_payment", notes: "session 2026-09-22" },
      { id: "c", status: "confirmed", notes: "session 2026-09-29" },
    ];
    expect(bookingForInvite(link, bookings)?.id).toBe("c");
  });

  it("a hand-added £0 place on another night doesn't count either (Ellie Davis)", () => {
    const ellie = [{ id: "hand", status: "confirmed", notes: "Added by admin | session 2026-09-14" }];
    expect(inviteIsPaid(LINK_TONIGHT, ellie)).toBe(false);
  });

  it("a link fulfilment has spent is paid even before its booking is read back", () => {
    expect(inviteIsPaid({ status: "accepted", session_dates: ["2026-09-22"] }, [])).toBe(true);
  });

  it("an undated link (monthly, termly, a private class's run) keeps the wider family match", () => {
    const link = { status: "pending", session_dates: null };
    const bookings = [{ id: "m", status: "confirmed", notes: "Membership class switch (subscription sub_1)" }];
    expect(bookingForInvite(link, bookings)?.id).toBe("m");
    expect(inviteIsPaid(link, bookings)).toBe(true);
    expect(inviteIsPaid(link, [])).toBe(false);
  });
});
