/**
 * Turning report_revenue's rows into what the Reports page shows: franchises, their venues, the
 * classes within each, and totals at every level — gross, Stripe's fee, the Nullshift 1%, net.
 *
 * The grouping rules, so nothing is quietly miscounted:
 *
 *   - A venue that belongs to a franchise goes under that franchisee (Ella, Brad, Boo).
 *   - Amie's own venues go under head office.
 *   - Money with no venue that is still clearly the studio's — class passes, parties, merchandise —
 *     also goes under head office, as its own line, rather than being invented a venue.
 *   - A venue nobody has assigned a franchise goes under "Uncategorised venues" and is flagged. A
 *     hall added next year must not silently count as Amie's.
 *   - Anything the sync could not match goes under "Unallocated", also flagged. Never dropped.
 */

export type ReportRow = {
  franchise_id: string | null;
  franchise_name: string | null;
  franchisee_name: string | null;
  is_head_office: boolean | null;
  venue_id: string | null;
  venue_name: string | null;
  class_id: string | null;
  class_name: string | null;
  kind: string;
  gross_pence: number | string;
  stripe_fee_pence: number | string;
  platform_fee_pence: number | string;
  net_pence: number | string;
  payment_count: number | string;
};

export type Totals = {
  grossPence: number;
  stripeFeePence: number;
  platformFeePence: number;
  netPence: number;
};

export type ClassLine = { key: string; label: string; totals: Totals };
export type VenueGroup = { key: string; label: string; totals: Totals; classes: ClassLine[] };
export type GroupType = "franchise" | "head_office" | "uncategorised" | "unallocated";
export type FranchiseGroup = {
  key: string;
  type: GroupType;
  label: string;
  /** "Ella", for a franchise; the explanation, for the flagged groups. */
  sublabel: string | null;
  flagged: boolean;
  totals: Totals;
  venues: VenueGroup[];
};

export const KIND_LABEL: Record<string, string> = {
  membership: "Monthly memberships",
  class: "Class bookings",
  camp: "Camps",
  pass: "Class passes",
  party: "Parties",
  merch: "Merchandise",
  unknown: "Unallocated",
};

/** Money with no venue that still plainly belongs to the studio. */
const STUDIO_KINDS = new Set(["pass", "party", "merch"]);

const zero = (): Totals => ({ grossPence: 0, stripeFeePence: 0, platformFeePence: 0, netPence: 0 });
const n = (v: number | string | null | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
function add(t: Totals, r: ReportRow): void {
  t.grossPence += n(r.gross_pence);
  t.stripeFeePence += n(r.stripe_fee_pence);
  t.platformFeePence += n(r.platform_fee_pence);
  t.netPence += n(r.net_pence);
}

export function totalsOf(rows: ReportRow[]): Totals {
  const t = zero();
  rows.forEach((r) => add(t, r));
  return t;
}

export function byKind(rows: ReportRow[]): { kind: string; label: string; totals: Totals }[] {
  const map = new Map<string, Totals>();
  for (const r of rows) {
    const t = map.get(r.kind) ?? zero();
    add(t, r);
    map.set(r.kind, t);
  }
  return [...map.entries()]
    .map(([kind, totals]) => ({ kind, label: KIND_LABEL[kind] ?? kind, totals }))
    .sort((a, b) => b.totals.netPence - a.totals.netPence);
}

const HEAD_OFFICE_FALLBACK = "__head_office";

function groupFor(r: ReportRow, headOfficeKey: string): { key: string; type: GroupType } {
  if (r.venue_id && r.franchise_id) {
    return { key: r.franchise_id, type: r.is_head_office ? "head_office" : "franchise" };
  }
  if (r.venue_id) return { key: "__uncategorised", type: "uncategorised" };
  if (STUDIO_KINDS.has(r.kind)) return { key: headOfficeKey, type: "head_office" };
  return { key: "__unallocated", type: "unallocated" };
}

const ORDER: Record<GroupType, number> = { franchise: 0, head_office: 1, uncategorised: 2, unallocated: 3 };

export function byFranchise(rows: ReportRow[]): FranchiseGroup[] {
  const headOfficeRow = rows.find((r) => r.is_head_office && r.franchise_id);
  const headOfficeKey = headOfficeRow?.franchise_id ?? HEAD_OFFICE_FALLBACK;
  const groups = new Map<string, FranchiseGroup>();

  for (const r of rows) {
    const { key, type } = groupFor(r, headOfficeKey);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        type,
        label:
          type === "franchise" ? r.franchise_name ?? "Franchise"
          : type === "head_office" ? headOfficeRow?.franchise_name ?? "The Dance Exclusive"
          : type === "uncategorised" ? "Uncategorised venues"
          : "Unallocated",
        sublabel:
          type === "franchise" ? r.franchisee_name ?? null
          : type === "uncategorised" ? "These venues have no franchise set. Assign one on the Venues page."
          : type === "unallocated" ? "Payments the sync could not match to a class or venue."
          : null,
        flagged: type === "uncategorised" || type === "unallocated",
        totals: zero(),
        venues: [],
      };
      groups.set(key, g);
    }
    add(g.totals, r);

    // The line within the group: a venue, or for venue-less studio money, what it was.
    const venueKey = r.venue_id ?? `__kind:${r.kind}`;
    const venueLabel = r.venue_name ?? KIND_LABEL[r.kind] ?? r.kind;
    let v = g.venues.find((x) => x.key === venueKey);
    if (!v) {
      v = { key: venueKey, label: venueLabel, totals: zero(), classes: [] };
      g.venues.push(v);
    }
    add(v.totals, r);

    if (r.class_id) {
      let c = v.classes.find((x) => x.key === r.class_id);
      if (!c) {
        c = { key: r.class_id, label: r.class_name ?? "Class", totals: zero() };
        v.classes.push(c);
      }
      add(c.totals, r);
    }
  }

  for (const g of groups.values()) {
    g.venues.sort((a, b) => b.totals.netPence - a.totals.netPence);
    g.venues.forEach((v) => v.classes.sort((a, b) => b.totals.netPence - a.totals.netPence));
  }
  return [...groups.values()].sort(
    (a, b) => ORDER[a.type] - ORDER[b.type] || b.totals.netPence - a.totals.netPence,
  );
}

export function formatPounds(pence: number): string {
  const sign = pence < 0 ? "−" : "";
  return `${sign}£${(Math.abs(pence) / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The instant a London calendar month starts, in UTC.
 *
 * The report is cash basis over payments.occurred_at, a timestamp. "October" to Amie means
 * October in London — so during BST it starts at 23:00 UTC on 30 September, and a payment at
 * 00:30 London time on the 1st belongs to October, not September. Month starts never fall on a
 * clock change (those are 01:00 UTC on the last Sunday of March and October), so the offset at
 * London midnight on the 1st is unambiguous.
 */
export function londonMonthStart(year: number, monthIndex: number): Date {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  const guess = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })
      .format(guess),
  ) % 24;
  // At 00:00 UTC London reads 00 (GMT) or 01 (BST). Step back by that many hours.
  return new Date(guess.getTime() - londonHour * 3_600_000);
}

/** [start, end) of a London month as ISO strings, for report_revenue(_from, _to). */
export function londonMonthRange(year: number, monthIndex: number): { from: string; to: string } {
  return {
    from: londonMonthStart(year, monthIndex).toISOString(),
    to: londonMonthStart(year, monthIndex + 1).toISOString(),
  };
}
