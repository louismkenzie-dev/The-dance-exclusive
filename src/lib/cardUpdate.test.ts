import { describe, expect, it } from "vitest";
import {
  cardBrandName,
  cardHealth,
  cardWarning,
  describeCard,
} from "../../supabase/functions/_shared/cardUpdate.ts";
import * as mirror from "./cardUpdate";

const on = (iso: string) => new Date(iso + "T12:00:00.000Z");
const card = (expMonth: number | null, expYear: number | null, last4 = "4242", brand = "visa") =>
  ({ brand, last4, expMonth, expYear });

describe("describeCard", () => {
  it("reads like the back of the card", () => {
    expect(describeCard(card(9, 2027))).toBe("Visa •••• 4242 · expires 09/27");
    expect(describeCard(card(12, 2030, "1881", "mastercard"))).toBe("Mastercard •••• 1881 · expires 12/30");
  });
  it("pads a single-digit month", () => {
    expect(describeCard(card(1, 2028))).toContain("expires 01/28");
  });
  it("copes with a card Stripe gave us no expiry for", () => {
    expect(describeCard(card(null, null))).toBe("Visa •••• 4242");
  });
  it("says so plainly when there is no card", () => {
    expect(describeCard(null)).toBe("No card saved");
    expect(describeCard({ brand: "visa", last4: null, expMonth: 9, expYear: 2027 })).toBe("No card saved");
  });
});

describe("cardBrandName", () => {
  it("uses the names people recognise", () => {
    expect(cardBrandName("amex")).toBe("American Express");
    expect(cardBrandName("visa")).toBe("Visa");
  });
  it("tidies up anything it doesn't know rather than showing a slug", () => {
    expect(cardBrandName("cartes_bancaires")).toBe("Cartes_bancaires");
    expect(cardBrandName(null)).toBe("Card");
  });
});

describe("cardHealth — a card is good until the END of its month", () => {
  it("is fine on the last day of the expiry month", () => {
    expect(cardHealth(card(9, 2026), on("2026-09-30"))).toBe("expiring");
  });
  it("is expired on the first day of the next month", () => {
    expect(cardHealth(card(9, 2026), on("2026-10-01"))).toBe("expired");
  });
  it("warns a month out, not before", () => {
    expect(cardHealth(card(9, 2026), on("2026-07-31"))).toBe("ok");
    expect(cardHealth(card(9, 2026), on("2026-08-01"))).toBe("expiring");
  });
  it("handles a December expiry rolling into the new year", () => {
    expect(cardHealth(card(12, 2026), on("2026-12-31"))).toBe("expiring");
    expect(cardHealth(card(12, 2026), on("2027-01-01"))).toBe("expired");
    expect(cardHealth(card(12, 2026), on("2026-10-31"))).toBe("ok");
    expect(cardHealth(card(12, 2026), on("2026-11-01"))).toBe("expiring");
  });
  it("says none when there is no card, which is not the same as expired", () => {
    expect(cardHealth(null, on("2026-09-23"))).toBe("none");
  });
  it("does not cry wolf when Stripe gave no expiry", () => {
    expect(cardHealth(card(null, null), on("2026-09-23"))).toBe("ok");
  });
});

describe("cardWarning", () => {
  it("leads with the failed payment — Jodie's case", () => {
    expect(cardWarning("ok", true)).toMatch(/didn't go through/);
    // A failed payment outranks an expiry warning: it is the live problem.
    expect(cardWarning("expiring", true)).toMatch(/didn't go through/);
  });
  it("warns before the money is missed", () => {
    expect(cardWarning("expired", false)).toMatch(/has expired/);
    expect(cardWarning("expiring", false)).toMatch(/expires soon/);
  });
  it("stays quiet when there is nothing wrong", () => {
    expect(cardWarning("ok", false)).toBeNull();
  });
});

describe("the client mirror and the server copy", () => {
  // The screen tells the family their card is fine; the server decides
  // whether to chase them. If these two drift, one of them is lying.
  it("agree on every card state", () => {
    const cards = [card(9, 2026), card(12, 2026), card(1, 2028), card(null, null), null];
    const days = ["2026-07-31", "2026-08-01", "2026-09-30", "2026-10-01", "2027-01-01"];
    for (const c of cards) {
      for (const d of days) {
        expect(mirror.cardHealth(c, on(d))).toBe(cardHealth(c, on(d)));
        expect(mirror.describeCard(c)).toBe(describeCard(c));
      }
    }
  });
  it("agree on what the family is told", () => {
    for (const h of ["none", "expired", "expiring", "ok"] as const) {
      for (const pastDue of [true, false]) {
        expect(mirror.cardWarning(h, pastDue)).toBe(cardWarning(h, pastDue));
      }
    }
  });
});
