import { describe, expect, it } from "vitest";
import { bookingForInvite, inviteAlreadyHeld, inviteIsPaid } from "./inviteMatching";

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

// Kirsty McAlpine, All Levels Hip Hop. Amie, 23 Sep: "Kirsty messaged saying
// she can't now find the link to pay for that class ... (never know if people
// are being silly or genuinely it's not there)". It was genuinely not there.
// Her pass covered five other nights on the same class, and My Bookings hid
// any invite for a class the dancer already had a live booking on — so the
// one night she still owed £10 for was filtered out of her own account.
const KIRSTY_LIVE = [
  { id: "p1", status: "confirmed", notes: "Class pass 46a33d78 — session 2026-09-09" },
  { id: "p2", status: "confirmed", notes: "Class pass 9418578d — session 2026-09-23" },
  { id: "p3", status: "confirmed", notes: "Class pass 9418578d — session 2026-09-30" },
  { id: "p4", status: "confirmed", notes: "Class pass 9418578d — session 2026-10-07" },
  { id: "p5", status: "confirmed", notes: "Class pass 9418578d — session 2026-10-14" },
];
const KIRSTY_LINK = { status: "pending", session_dates: ["2026-09-16"] };

describe("inviteAlreadyHeld — the link Kirsty couldn't find", () => {
  it("does not count other nights on the same class as this night being held", () => {
    expect(inviteAlreadyHeld(KIRSTY_LINK, KIRSTY_LIVE)).toBe(false);
    expect(inviteIsPaid(KIRSTY_LINK, KIRSTY_LIVE)).toBe(false);
  });

  it("counts it once the night itself is booked, so the card goes away", () => {
    const paid = [...KIRSTY_LIVE, { id: "new", status: "confirmed", notes: "Stripe PaymentIntent: pi_3X | session 2026-09-16" }];
    expect(inviteAlreadyHeld(KIRSTY_LINK, paid)).toBe(true);
  });

  it("counts a place still going through checkout, so it can't be paid twice", () => {
    const midway = [...KIRSTY_LIVE, { id: "wip", status: "pending_payment", notes: "session 2026-09-16" }];
    expect(inviteAlreadyHeld(KIRSTY_LINK, midway)).toBe(true);
  });

  it("ignores the cancelled 16 Sep pass booking that caused the link in the first place", () => {
    // The portal only ever passes live bookings in; the cancelled one that
    // freed up this night must not come back as proof the night is held.
    expect(inviteAlreadyHeld(KIRSTY_LINK, KIRSTY_LIVE.filter((b) => b.status === "confirmed"))).toBe(false);
  });

  it("still hides an undated invite the family already has a place for", () => {
    const monthly = { status: "pending", session_dates: null };
    expect(inviteAlreadyHeld(monthly, [{ id: "m", status: "confirmed", notes: "Membership" }])).toBe(true);
    expect(inviteAlreadyHeld(monthly, [])).toBe(false);
  });
});
