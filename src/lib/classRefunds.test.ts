import { describe, expect, it } from "vitest";
import {
  allocateRefund,
  alreadyRefunded,
  bookingCoverage,
  creditCode,
  passRef,
  paymentRef,
  periodCoverage,
  proRata,
} from "../../supabase/functions/_shared/classRefunds.ts";

const TODAY = "2026-09-21";
// A Thursday class, weekly from 3 Sep to 17 Dec, half term skipped.
const SESSIONS = [
  "2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01", "2026-10-08",
  "2026-10-15", "2026-10-22", "2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26",
  "2026-12-03", "2026-12-10", "2026-12-17",
];

describe("proRata", () => {
  it("gives back the share of classes that haven't happened", () => {
    expect(proRata(84.5, { total: 13, left: 12 })).toBe(78);
  });
  it("gives everything back when nothing has happened yet", () => {
    expect(proRata(84.5, { total: 13, left: 13 })).toBe(84.5);
  });
  it("gives nothing back when it's all been delivered, or nothing was paid", () => {
    expect(proRata(84.5, { total: 13, left: 0 })).toBe(0);
    expect(proRata(0, { total: 13, left: 13 })).toBe(0);
    expect(proRata(84.5, { total: 0, left: 0 })).toBe(0);
  });
  it("rounds to the penny", () => {
    expect(proRata(27.2, { total: 4, left: 3 })).toBe(20.4);
    expect(proRata(10, { total: 3, left: 1 })).toBe(3.33);
  });
});

describe("bookingCoverage", () => {
  it("a dated booking is one class, owed only if it's still to come", () => {
    expect(bookingCoverage("session", "Stripe PaymentIntent: pi_1 | session 2026-09-24", "2026-09-01", null, SESSIONS, TODAY))
      .toEqual({ total: 1, left: 1 });
    expect(bookingCoverage("trial", "pi_1 | session 2026-09-17", "2026-09-01", null, SESSIONS, TODAY))
      .toEqual({ total: 1, left: 0 });
    // Today's class counts as still to come — it's cancelled with the rest.
    expect(bookingCoverage("session", "session 2026-09-21", "2026-09-01", null, SESSIONS, TODAY))
      .toEqual({ total: 1, left: 1 });
  });

  it("a term booking covers the class's sessions from the day it was booked to term end", () => {
    // Booked on the first day: all 15 sessions, 12 still to come.
    expect(bookingCoverage("term", "pi_1", "2026-09-01", "2026-12-18", SESSIONS, TODAY))
      .toEqual({ total: 15, left: 12 });
    // Joined late, on 10 Sep: 14 sessions bought (10 Sep to 17 Dec), 12 left.
    expect(bookingCoverage("term", "pi_1", "2026-09-10", "2026-12-18", SESSIONS, TODAY))
      .toEqual({ total: 14, left: 12 });
    // Term end before the last session cuts the window.
    expect(bookingCoverage("term", "pi_1", "2026-09-01", "2026-10-31", SESSIONS, TODAY))
      .toEqual({ total: 8, left: 5 });
  });

  it("a yearly booking runs from the booking day with no term cap", () => {
    expect(bookingCoverage("yearly", "pi_1", "2026-09-10", "2026-10-31", SESSIONS, TODAY))
      .toEqual({ total: 14, left: 12 });
  });

  it("a standing monthly booking is not answered here", () => {
    expect(bookingCoverage("monthly", "sub_1", "2026-09-01", null, SESSIONS, TODAY))
      .toEqual({ total: 0, left: 0 });
  });
});

describe("periodCoverage", () => {
  it("counts the sessions inside a billing period and how many are still to come", () => {
    expect(periodCoverage(SESSIONS, "2026-09-05", "2026-10-05", TODAY)).toEqual({ total: 4, left: 2 });
  });
  it("a period with no classes in it (August) is worth nothing", () => {
    expect(periodCoverage(SESSIONS, "2026-08-05", "2026-09-02", TODAY)).toEqual({ total: 0, left: 0 });
  });
});

describe("notes markers", () => {
  it("finds the payment, the pass and an earlier refund", () => {
    expect(paymentRef("Stripe PaymentIntent: pi_3Abc123 | session 2026-09-24")).toBe("pi_3Abc123");
    expect(paymentRef("Membership class switch (subscription sub_1)")).toBeNull();
    expect(passRef("Class pass 3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b — session 2026-09-24"))
      .toBe("3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b");
    expect(alreadyRefunded("pi_1 | refunded £12.00 on 2026-09-01 (re_1)")).toBe(true);
    expect(alreadyRefunded("pi_1")).toBe(false);
  });
});

describe("allocateRefund", () => {
  it("puts the money on the payments that can carry it, biggest first", () => {
    const remaining = new Map([["pi_a", 8450], ["pi_b", 900]]);
    const { plan, unplacedPence } = allocateRefund(
      8000,
      [
        { id: "b1", paymentIntentId: "pi_a", maxPence: 7800 },
        { id: "b2", paymentIntentId: "pi_b", maxPence: 900 },
      ],
      remaining,
    );
    expect(plan).toEqual([
      { id: "b1", paymentIntentId: "pi_a", pence: 7800 },
      { id: "b2", paymentIntentId: "pi_b", pence: 200 },
    ]);
    expect(unplacedPence).toBe(0);
  });

  it("never takes more from one payment than it has left, even across two bookings on it", () => {
    // One family checkout paid for two children on one payment; £10 of it
    // was refunded by hand last week.
    const remaining = new Map([["pi_a", 1000]]);
    const { plan, unplacedPence } = allocateRefund(
      1600,
      [
        { id: "b1", paymentIntentId: "pi_a", maxPence: 800 },
        { id: "b2", paymentIntentId: "pi_a", maxPence: 800 },
      ],
      remaining,
    );
    expect(plan.reduce((n, p) => n + p.pence, 0)).toBe(1000);
    expect(unplacedPence).toBe(600);
  });

  it("an amount Amie has lowered is spread and no more", () => {
    const remaining = new Map([["pi_a", 8450]]);
    const { plan } = allocateRefund(2000, [{ id: "b1", paymentIntentId: "pi_a", maxPence: 7800 }], remaining);
    expect(plan).toEqual([{ id: "b1", paymentIntentId: "pi_a", pence: 2000 }]);
  });
});

describe("creditCode", () => {
  it("is the studio's TDE- format with no lookalike characters", () => {
    const code = creditCode();
    expect(code).toMatch(/^TDE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(creditCode(() => 0)).toBe("TDE-AAAAAAAA");
  });
});
