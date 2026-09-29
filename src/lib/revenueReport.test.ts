import { describe, expect, it } from "vitest";
import {
  byFranchise,
  byKind,
  formatPounds,
  londonMonthRange,
  londonMonthStart,
  totalsOf,
  type ReportRow,
} from "./revenueReport";

const HO = "f0000000-0000-4000-8000-000000000001";
const ELLA = "f0000000-0000-4000-8000-000000000002";
const BRAD = "f0000000-0000-4000-8000-000000000003";

function row(p: Partial<ReportRow> & { gross: number; stripe?: number; platform?: number }): ReportRow {
  const stripe = p.stripe ?? 0;
  const platform = p.platform ?? 0;
  return {
    franchise_id: null,
    franchise_name: null,
    franchisee_name: null,
    is_head_office: false,
    venue_id: null,
    venue_name: null,
    class_id: null,
    class_name: null,
    kind: "membership",
    gross_pence: p.gross,
    stripe_fee_pence: stripe,
    platform_fee_pence: platform,
    net_pence: p.gross - stripe - platform,
    payment_count: 1,
    ...p,
  };
}

const ella = { franchise_id: ELLA, franchise_name: "Chelmsford & Wickford", franchisee_name: "Ella", is_head_office: false };
const brad = { franchise_id: BRAD, franchise_name: "Clacton", franchisee_name: "Brad", is_head_office: false };
const ho = { franchise_id: HO, franchise_name: "The Dance Exclusive", franchisee_name: "Amie Whitaker", is_head_office: true };

const ROWS: ReportRow[] = [
  row({ ...ella, venue_id: "v-coval", venue_name: "Coval Lane", class_id: "c1", class_name: "Mixed Street", gross: 11000, stripe: 190, platform: 110 }),
  row({ ...ella, venue_id: "v-coval", venue_name: "Coval Lane", class_id: "c2", class_name: "Diva Dance", gross: 5000, stripe: 95, platform: 50 }),
  row({ ...ella, venue_id: "v-wick", venue_name: "Nevendon Centre", class_id: "c3", class_name: "Tots", kind: "class", gross: 1200, stripe: 38, platform: 12 }),
  row({ ...brad, venue_id: "v-clac", venue_name: "County High", class_id: "c4", class_name: "Hip Hop", gross: 3060, stripe: 66, platform: 31 }),
  row({ ...ho, venue_id: "v-brain", venue_name: "Braintree", class_id: "c5", class_name: "Ballet", gross: 2635, stripe: 57, platform: 26 }),
  // Studio money with no venue: a class pass and a party.
  row({ kind: "pass", gross: 4500, stripe: 88, platform: 45 }),
  row({ kind: "party", gross: 15000, stripe: 245, platform: 150 }),
  // A venue nobody has put in a franchise.
  row({ venue_id: "v-new", venue_name: "New Hall", class_id: "c6", class_name: "Street", gross: 1000, stripe: 34, platform: 10 }),
  // Money the sync could not match.
  row({ kind: "unknown", gross: 700, stripe: 30, platform: 7 }),
  // A refund against Mixed Street.
  row({ ...ella, venue_id: "v-coval", venue_name: "Coval Lane", class_id: "c1", class_name: "Mixed Street", gross: -2750, stripe: 0, platform: -27 }),
];

describe("totalsOf", () => {
  it("adds every column, and net always equals gross less both fees", () => {
    const t = totalsOf(ROWS);
    expect(t.grossPence).toBe(11000 + 5000 + 1200 + 3060 + 2635 + 4500 + 15000 + 1000 + 700 - 2750);
    expect(t.netPence).toBe(t.grossPence - t.stripeFeePence - t.platformFeePence);
  });

  it("reads bigint columns that PostgREST returns as strings", () => {
    const t = totalsOf([{ ...ROWS[0], gross_pence: "11000", stripe_fee_pence: "190", platform_fee_pence: "110", net_pence: "10700" }]);
    expect(t).toEqual({ grossPence: 11000, stripeFeePence: 190, platformFeePence: 110, netPence: 10700 });
  });

  it("is all zeros for an empty month", () => {
    expect(totalsOf([])).toEqual({ grossPence: 0, stripeFeePence: 0, platformFeePence: 0, netPence: 0 });
  });
});

describe("byFranchise", () => {
  const groups = byFranchise(ROWS);
  const find = (label: string) => groups.find((g) => g.label === label)!;

  it("puts franchisees first, then head office, then the flagged groups", () => {
    expect(groups.map((g) => g.type)).toEqual(["franchise", "franchise", "head_office", "uncategorised", "unallocated"]);
    expect(groups[0].label).toBe("Chelmsford & Wickford");
    expect(groups[0].sublabel).toBe("Ella");
  });

  it("groups Ella's two venues under one franchise", () => {
    const g = find("Chelmsford & Wickford");
    expect(g.venues.map((v) => v.label)).toEqual(["Coval Lane", "Nevendon Centre"]);
    expect(g.totals.grossPence).toBe(11000 + 5000 + 1200 - 2750);
  });

  it("nets a refund off the class it came from", () => {
    const coval = find("Chelmsford & Wickford").venues[0];
    const mixed = coval.classes.find((c) => c.label === "Mixed Street")!;
    expect(mixed.totals.grossPence).toBe(11000 - 2750);
    expect(mixed.totals.platformFeePence).toBe(110 - 27);
  });

  it("files venue-less studio money under head office, labelled by what it was", () => {
    const g = find("The Dance Exclusive");
    expect(g.type).toBe("head_office");
    expect(g.venues.map((v) => v.label).sort()).toEqual(["Braintree", "Class passes", "Parties"]);
    expect(g.totals.grossPence).toBe(2635 + 4500 + 15000);
  });

  it("flags a venue with no franchise instead of counting it as Amie's", () => {
    const g = find("Uncategorised venues");
    expect(g.flagged).toBe(true);
    expect(g.venues[0].label).toBe("New Hall");
    expect(find("The Dance Exclusive").venues.some((v) => v.label === "New Hall")).toBe(false);
  });

  it("keeps unmatched money visible rather than dropping it", () => {
    const g = find("Unallocated");
    expect(g.flagged).toBe(true);
    expect(g.totals.grossPence).toBe(700);
  });

  it("loses nothing: the groups add back to the whole", () => {
    const sum = groups.reduce((s, g) => s + g.totals.netPence, 0);
    expect(sum).toBe(totalsOf(ROWS).netPence);
    for (const g of groups) {
      expect(g.venues.reduce((s, v) => s + v.totals.netPence, 0)).toBe(g.totals.netPence);
    }
  });

  it("still finds head office for passes when no head-office venue took money that month", () => {
    const only = byFranchise([row({ kind: "pass", gross: 4500 })]);
    expect(only).toHaveLength(1);
    expect(only[0].type).toBe("head_office");
    expect(only[0].label).toBe("The Dance Exclusive");
  });

  it("does not file an unmatched membership with no venue under head office", () => {
    const only = byFranchise([row({ kind: "membership", gross: 3060 })]);
    expect(only[0].type).toBe("unallocated");
  });
});

describe("byKind", () => {
  it("splits the month by source, biggest first", () => {
    const k = byKind(ROWS);
    expect(k.map((x) => x.label).slice(0, 2)).toEqual(["Monthly memberships", "Parties"]);
    expect(k.find((x) => x.kind === "membership")!.totals.grossPence).toBe(11000 + 5000 + 3060 + 2635 + 1000 - 2750);
    expect(k.find((x) => x.kind === "unknown")!.label).toBe("Unallocated");
  });
});

describe("formatPounds", () => {
  it("formats pence as pounds with thousands separators", () => {
    expect(formatPounds(123456)).toBe("£1,234.56");
    expect(formatPounds(5)).toBe("£0.05");
    expect(formatPounds(-2750)).toBe("−£27.50");
  });
});

describe("London months", () => {
  it("starts a BST month at 23:00 UTC the day before", () => {
    expect(londonMonthStart(2026, 9).toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("starts a GMT month at midnight UTC", () => {
    expect(londonMonthStart(2026, 10).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(londonMonthStart(2026, 0).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rolls over the year", () => {
    expect(londonMonthRange(2026, 11)).toEqual({ from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" });
    expect(londonMonthStart(2026, -1).toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });

  it("covers the clock change inside October without a gap or overlap", () => {
    const oct = londonMonthRange(2026, 9);
    const nov = londonMonthRange(2026, 10);
    expect(oct.to).toBe(nov.from);
    expect(oct.from).toBe("2026-09-30T23:00:00.000Z");
  });
});
