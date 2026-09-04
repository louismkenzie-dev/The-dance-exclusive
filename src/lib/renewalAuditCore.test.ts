// Covers the pure logic behind scripts/stripe-billing-audit.mjs — the
// read-only live renewal auditor. The audit's whole verdict rests on two
// things being right: which London calendar day a Stripe UTC timestamp falls
// on, and Stripe's payment-method precedence. Both are tested here.
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs operator script, deliberately dependency-free.
import {
  cardExpired,
  dueOnDay,
  londonDayBounds,
  londonStamp,
  londonYMD,
  nextBillingDay,
  resolvePaymentMethod,
} from "../../scripts/lib/renewalAuditCore.mjs";

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("londonDayBounds", () => {
  it("spans a BST day as 23:00→23:00 UTC", () => {
    const [start, end] = londonDayBounds("2026-09-05");
    expect(new Date(start * 1000).toISOString()).toBe("2026-09-04T23:00:00.000Z");
    expect(new Date(end * 1000).toISOString()).toBe("2026-09-05T23:00:00.000Z");
  });

  it("spans a GMT day as 00:00→00:00 UTC", () => {
    const [start, end] = londonDayBounds("2026-12-05");
    expect(new Date(start * 1000).toISOString()).toBe("2026-12-05T00:00:00.000Z");
    expect(new Date(end * 1000).toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });

  it("handles the BST→GMT transition day (25 hours long)", () => {
    const [start, end] = londonDayBounds("2026-10-25"); // clocks go back
    expect((end - start) / 3600).toBe(25);
  });

  it("handles the GMT→BST transition day (23 hours long)", () => {
    const [start, end] = londonDayBounds("2026-03-29"); // clocks go forward
    expect((end - start) / 3600).toBe(23);
  });

  it("rolls over month and year ends", () => {
    const [, end] = londonDayBounds("2026-12-31");
    expect(new Date(end * 1000).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("the 07:00 UTC billing anchor lands on the 5th in London", () => {
  // supabase/functions/_shared/billing.ts anchors trials at 07:00 UTC on the
  // 5th precisely so this holds in both GMT and BST.
  it("is 5 September in London (BST)", () => {
    expect(londonYMD(new Date("2026-09-05T07:00:00Z"))).toBe("2026-09-05");
  });
  it("is 5 January in London (GMT)", () => {
    expect(londonYMD(new Date("2027-01-05T07:00:00Z"))).toBe("2027-01-05");
  });
  it("renders a readable London stamp", () => {
    expect(londonStamp(unix("2026-09-05T07:00:00Z"))).toBe("2026-09-05 08:00 Europe/London");
  });
});

describe("dueOnDay", () => {
  const [start, end] = londonDayBounds("2026-09-05");

  it("matches an active subscription on current_period_end", () => {
    const hit = dueOnDay({ current_period_end: unix("2026-09-05T07:00:00Z") }, start, end);
    expect(hit).toEqual({ anchorField: "current_period_end", anchorUnix: unix("2026-09-05T07:00:00Z") });
  });

  it("matches a trialing subscription whose trial ends that day", () => {
    const hit = dueOnDay(
      { current_period_end: unix("2026-08-20T10:00:00Z"), trial_end: unix("2026-09-05T07:00:00Z") },
      start, end,
    );
    expect(hit?.anchorField).toBe("trial_end");
  });

  it("does NOT match 23:30 UTC on 4 September — that is already the 5th in London", () => {
    // The trap this function exists to avoid: a naive UTC-date comparison
    // would call this the 4th and silently drop the subscription.
    const hit = dueOnDay({ current_period_end: unix("2026-09-04T23:30:00Z") }, start, end);
    expect(hit).not.toBeNull();
  });

  it("excludes 22:30 UTC on 4 September (still the 4th in London)", () => {
    expect(dueOnDay({ current_period_end: unix("2026-09-04T22:30:00Z") }, start, end)).toBeNull();
  });

  it("excludes the next day", () => {
    expect(dueOnDay({ current_period_end: unix("2026-09-06T07:00:00Z") }, start, end)).toBeNull();
  });

  it("ignores subscriptions with no timestamps at all", () => {
    expect(dueOnDay({}, start, end)).toBeNull();
  });
});

describe("nextBillingDay", () => {
  it("returns this month's 5th before the 5th", () => {
    expect(nextBillingDay(new Date("2026-09-04T12:00:00Z"))).toBe("2026-09-05");
  });
  it("rolls to next month on and after the 5th", () => {
    expect(nextBillingDay(new Date("2026-09-05T12:00:00Z"))).toBe("2026-10-05");
  });
  it("rolls across the year boundary", () => {
    expect(nextBillingDay(new Date("2026-12-20T12:00:00Z"))).toBe("2027-01-05");
  });
});

describe("resolvePaymentMethod — Stripe's precedence rules", () => {
  it("prefers the subscription's default over the customer's", () => {
    const r = resolvePaymentMethod({
      subscription: { default_payment_method: "pm_sub" },
      customer: { invoice_settings: { default_payment_method: "pm_cust" } },
    });
    expect(r.id).toBe("pm_sub");
    expect(r.source).toBe("subscription.default_payment_method");
  });

  it("falls back to the customer's invoice-settings default", () => {
    const r = resolvePaymentMethod({
      subscription: { default_payment_method: null },
      customer: { invoice_settings: { default_payment_method: "pm_cust" } },
    });
    expect(r.id).toBe("pm_cust");
    expect(r.source).toBe("customer.invoice_settings.default_payment_method");
  });

  it("lets an upcoming invoice's own default outrank the subscription", () => {
    const r = resolvePaymentMethod({
      subscription: { default_payment_method: "pm_sub" },
      customer: {},
      upcomingInvoice: { default_payment_method: "pm_inv" },
    });
    expect(r.source).toBe("invoice.default_payment_method");
  });

  it("accepts expanded objects as well as ids", () => {
    const r = resolvePaymentMethod({ subscription: { default_payment_method: { id: "pm_expanded" } }, customer: {} });
    expect(r.id).toBe("pm_expanded");
  });

  it("still finds a legacy card source below the PaymentMethod levels", () => {
    const r = resolvePaymentMethod({ subscription: {}, customer: { default_source: "card_legacy" } });
    expect(r.id).toBe("card_legacy");
    expect(r.source).toBe("customer.default_source");
  });

  it("reports nothing usable when every level is empty — the RED case", () => {
    const r = resolvePaymentMethod({ subscription: {}, customer: {} });
    expect(r.id).toBeNull();
    expect(r.source).toBeNull();
    expect(r.chain).toHaveLength(6);
  });
});

describe("cardExpired", () => {
  const billing = unix("2026-09-05T07:00:00Z");

  it("treats a card expiring in the billing month as still valid", () => {
    expect(cardExpired(9, 2026, billing)).toBe(false);
  });
  it("treats the previous month as expired", () => {
    expect(cardExpired(8, 2026, billing)).toBe(true);
  });
  it("treats a future year as valid", () => {
    expect(cardExpired(1, 2030, billing)).toBe(false);
  });
  it("returns null when the card has no expiry (non-card methods)", () => {
    expect(cardExpired(null, null, billing)).toBeNull();
  });
});
