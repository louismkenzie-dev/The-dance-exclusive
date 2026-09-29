import { describe, expect, it } from "vitest";
import {
  buildPayouts,
  hallHire,
  minutesOf,
  passSessionPence,
  payoutCsvRows,
  type PayoutClass,
  type PayoutFranchise,
  type PayoutSession,
  type PayoutVenue,
} from "./franchisePayout";
import type { ReportRow } from "./revenueReport";

// Boo's Harrow, as it is on live: £34 an hour, three Thursday classes.
const BOO: PayoutFranchise = { id: "f4", name: "Harrow", franchiseeName: "Boo", sharePercent: 0, staffId: "st-boo" };
const HARROW: PayoutVenue = { id: "v-harrow", name: "Harrow Arts Centre", franchiseId: "f4", hirePerHour: "34", hirePerDay: null };
const CLASSES: PayoutClass[] = [
  { id: "c-street", name: "Mixed Street", venueId: "v-harrow", startTime: "17:45:00", endTime: "18:45:00" },
  { id: "c-comp", name: "Competition Team Training", venueId: "v-harrow", startTime: "18:50:00", endTime: "19:45:00" },
  { id: "c-adult", name: "All Levels Hip Hop", venueId: "v-harrow", startTime: "19:45:00", endTime: "20:45:00" },
];
const THURSDAYS = ["2026-09-10", "2026-09-17", "2026-09-24"];
const sessionsOf = (classId: string, dates = THURSDAYS): PayoutSession[] =>
  dates.map((date) => ({ classId, date, startTime: null, endTime: null, status: "scheduled" }));
const SESSIONS = [...sessionsOf("c-street"), ...sessionsOf("c-comp"), ...sessionsOf("c-adult")];

const rev = (p: Partial<ReportRow> & { gross: number; stripe: number; platform: number }): ReportRow => ({
  franchise_id: "f4", franchise_name: "Harrow", franchisee_name: "Boo", is_head_office: false,
  venue_id: "v-harrow", venue_name: "Harrow Arts Centre", class_id: null, class_name: null, kind: "membership",
  gross_pence: p.gross, stripe_fee_pence: p.stripe, platform_fee_pence: p.platform,
  net_pence: p.gross - p.stripe - p.platform, payment_count: 1, ...p,
});
// Amie's example: kids paying £30.60 a month. Four of them on Mixed Street, one on Comp.
// Stripe: 1.5% + 20p each (46p + 20p = 66p). Nullshift: 1% (31p).
const REVENUE = [
  rev({ class_id: "c-street", class_name: "Mixed Street", gross: 12240, stripe: 264, platform: 122, payment_count: 4 }),
  rev({ class_id: "c-comp", class_name: "Competition Team Training", gross: 3060, stripe: 66, platform: 31 }),
];

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

describe("minutesOf", () => {
  it("reads HH:MM and HH:MM:SS", () => {
    expect(minutesOf("17:45")).toBe(1065);
    expect(minutesOf("20:45:00")).toBe(1245);
    expect(minutesOf(null)).toBeNull();
    expect(minutesOf("25:00")).toBeNull();
  });
});

describe("hallHire", () => {
  it("charges each session its own length at the venue's hourly rate", () => {
    const { byClass } = hallHire(SESSIONS, byId(CLASSES), byId([HARROW]));
    expect(byClass.get("c-street")).toEqual({ sessions: 3, minutes: 180, pence: 10200 });
    // 55 minutes at £34 an hour is £31.17, three times.
    expect(byClass.get("c-comp")).toEqual({ sessions: 3, minutes: 165, pence: 3 * 3117 });
  });

  it("never charges the same minutes twice when classes overlap in one hall", () => {
    const classes = byId<PayoutClass>([
      { id: "a", name: "A", venueId: "v", startTime: "17:00", endTime: "18:00" },
      { id: "b", name: "B", venueId: "v", startTime: "17:30", endTime: "18:30" },
    ]);
    const venue = byId<PayoutVenue>([{ id: "v", name: "Hall", franchiseId: "f", hirePerHour: 20, hirePerDay: null }]);
    const { byClass } = hallHire(
      [{ classId: "a", date: "2026-09-07", startTime: null, endTime: null, status: "scheduled" },
       { classId: "b", date: "2026-09-07", startTime: null, endTime: null, status: "scheduled" }],
      classes, venue,
    );
    expect(byClass.get("a")!.pence + byClass.get("b")!.pence).toBe(3000); // 90 minutes, not 120
    expect(byClass.get("b")!.minutes).toBe(30);
  });

  it("charges alternate-week classes in the same slot separately, because they are different nights", () => {
    const classes = byId<PayoutClass>([
      { id: "commercial", name: "Commercial", venueId: "v", startTime: "20:15", endTime: "21:30" },
      { id: "heels", name: "Heels", venueId: "v", startTime: "20:15", endTime: "21:30" },
    ]);
    const venue = byId<PayoutVenue>([{ id: "v", name: "Coval Lane", franchiseId: "f", hirePerHour: 25, hirePerDay: null }]);
    const { byClass } = hallHire(
      [...sessionsOf("commercial", ["2026-09-07", "2026-09-21"]), ...sessionsOf("heels", ["2026-09-14", "2026-09-28"])],
      classes, venue,
    );
    // 75 minutes at £25 an hour is £31.25, twice each.
    expect(byClass.get("commercial")!.pence).toBe(6250);
    expect(byClass.get("heels")!.pence).toBe(6250);
  });

  it("uses a session's own times when it was moved", () => {
    const { byClass } = hallHire(
      [{ classId: "c-street", date: "2026-09-10", startTime: "17:45:00", endTime: "19:15:00", status: "scheduled" }],
      byId(CLASSES), byId([HARROW]),
    );
    expect(byClass.get("c-street")!.pence).toBe(5100); // 90 minutes
  });

  it("does not charge a cancelled session", () => {
    const { byClass } = hallHire(
      [...sessionsOf("c-street", ["2026-09-10"]), { classId: "c-street", date: "2026-09-17", startTime: null, endTime: null, status: "cancelled" }],
      byId(CLASSES), byId([HARROW]),
    );
    expect(byClass.get("c-street")).toEqual({ sessions: 1, minutes: 60, pence: 3400 });
  });

  it("charges a daily rate once per date, whatever runs that day", () => {
    const venue = byId<PayoutVenue>([{ id: "v-harrow", name: "Hall", franchiseId: "f4", hirePerHour: null, hirePerDay: "45" }]);
    const { byClass } = hallHire(SESSIONS, byId(CLASSES), venue);
    const total = ["c-street", "c-comp", "c-adult"].reduce((s, id) => s + byClass.get(id)!.pence, 0);
    expect(total).toBe(3 * 4500);
  });

  it("flags a venue with no rate instead of quietly charging nothing", () => {
    const venue = byId<PayoutVenue>([{ id: "v-harrow", name: "Hall", franchiseId: "f4", hirePerHour: null, hirePerDay: null }]);
    const { missingRate } = hallHire(SESSIONS, byId(CLASSES), venue);
    expect([...missingRate]).toEqual(["v-harrow"]);
  });

  it("treats a £0 rate as free, not as missing", () => {
    const venue = byId<PayoutVenue>([{ id: "v-harrow", name: "School", franchiseId: "f4", hirePerHour: "0", hirePerDay: null }]);
    const { byClass, missingRate } = hallHire(SESSIONS, byId(CLASSES), venue);
    expect(missingRate.size).toBe(0);
    expect(byClass.get("c-street")!.pence).toBe(0);
  });
});

describe("passSessionPence", () => {
  it("values a session at the pass price per session, less the fees that purchase paid", () => {
    expect(passSessionPence({ classId: "x", passPrice: 36, passSessions: 4, netRatio: 0.97 })).toEqual({ pence: 873, feesKnown: true });
  });

  it("falls back to the gross value, and says so, when the purchase isn't in the ledger yet", () => {
    expect(passSessionPence({ classId: "x", passPrice: 36, passSessions: 4, netRatio: null })).toEqual({ pence: 900, feesKnown: false });
  });

  it("is worth nothing for a free pass", () => {
    expect(passSessionPence({ classId: "x", passPrice: 0, passSessions: 4, netRatio: null }).pence).toBe(0);
  });
});

describe("buildPayouts", () => {
  const base = {
    franchises: [BOO],
    venues: [HARROW, { id: "v-braintree", name: "Braintree", franchiseId: "f1", hirePerHour: 22, hirePerDay: null }],
    classes: CLASSES,
    sessions: SESSIONS,
    passUses: [
      { classId: "c-adult", passPrice: 36, passSessions: 4, netRatio: 0.97 },
      { classId: "c-adult", passPrice: 36, passSessions: 4, netRatio: 0.97 },
    ],
    revenue: REVENUE,
    instructors: [
      { classId: "c-street", staffId: "st-boo", name: "Boo Morrison", role: "main" },
      { classId: "c-adult", staffId: "st-kay", name: "Kayleigh Matthias", role: "main" },
    ],
  };

  it("works Amie's sum: money in after fees, plus passes, less hall hire", () => {
    const [p] = buildPayouts(base);
    const street = p.venues[0].classes.find((c) => c.name === "Mixed Street")!;
    expect(street.moneyIn.netPence).toBe(12240 - 264 - 122);
    expect(street.hirePence).toBe(10200);
    expect(street.profitPence).toBe(11854 - 10200);
    expect(street.payments).toBe(4);

    const adult = p.venues[0].classes.find((c) => c.name === "All Levels Hip Hop")!;
    expect(adult.passSessions).toBe(2);
    expect(adult.passCreditPence).toBe(2 * 873);
    expect(adult.profitPence).toBe(2 * 873 - 10200);

    const t = p.totals;
    expect(t.profitPence).toBe(t.netPence + t.passCreditPence - t.hirePence);
    expect(p.payoutPence).toBe(t.profitPence);
  });

  it("can come out as a loss, and says so rather than hiding it", () => {
    const [p] = buildPayouts(base);
    expect(p.payoutPence).toBeLessThan(0);
  });

  it("lists classes in the order they run", () => {
    const [p] = buildPayouts(base);
    expect(p.venues[0].classes.map((c) => c.name)).toEqual(["Mixed Street", "Competition Team Training", "All Levels Hip Hop"]);
  });

  it("points out a class somebody else leads, without deducting anything for it", () => {
    const [p] = buildPayouts(base);
    const adult = p.venues[0].classes.find((c) => c.name === "All Levels Hip Hop")!;
    expect(adult.otherCoaches).toEqual(["Kayleigh Matthias (main)"]);
    expect(p.venues[0].classes.find((c) => c.name === "Mixed Street")!.otherCoaches).toEqual([]);
  });

  it("takes head office's share of money in, when one is set", () => {
    const [p] = buildPayouts({
      ...base,
      franchises: [{ ...BOO, sharePercent: 10 }],
      sessions: [],
    });
    const base_ = p.totals.netPence + p.totals.passCreditPence;
    expect(p.sharePence).toBe(Math.round(base_ / 10));
    expect(p.payoutPence).toBe(p.totals.profitPence - p.sharePence);
  });

  it("puts venue money not tied to a class — a camp — into the venue's total", () => {
    const [p] = buildPayouts({ ...base, revenue: [...REVENUE, rev({ kind: "camp", gross: 5000, stripe: 95, platform: 50 })] });
    expect(p.venues[0].otherMoneyIn.netPence).toBe(4855);
    expect(p.totals.netPence).toBe(11854 + 2963 + 4855);
  });

  it("ignores other franchises' venues and money", () => {
    const [p] = buildPayouts({
      ...base,
      revenue: [...REVENUE, rev({ venue_id: "v-braintree", class_id: "c-x", gross: 99999, stripe: 0, platform: 0 })],
    });
    expect(p.venues.map((v) => v.name)).toEqual(["Harrow Arts Centre"]);
    expect(p.totals.grossPence).toBe(12240 + 3060);
  });

  it("notes when some pass fees are unknown", () => {
    const [p] = buildPayouts({ ...base, passUses: [{ classId: "c-adult", passPrice: 36, passSessions: 4, netRatio: null }] });
    expect(p.passFeesUnknown).toBe(true);
  });

  it("writes a statement whose last line is the payout", () => {
    const [p] = buildPayouts(base);
    const rows = payoutCsvRows(p);
    expect(rows[0].slice(0, 2)).toEqual(["Harrow Arts Centre", "Mixed Street"]);
    const last = rows[rows.length - 1];
    expect(last[0]).toBe("Loss for the month (Boo)"); // this sample month is a loss
    const [profitable] = buildPayouts({ ...base, sessions: [] });
    const rows2 = payoutCsvRows(profitable);
    expect(rows2[rows2.length - 1][0]).toBe("Payout to Boo");
    expect(last[12]).toBe(p.payoutPence / 100);
    expect(typeof last[12]).toBe("number"); // a loss stays a number in Excel, not text
  });
});
