/**
 * What Amie pays each franchisee for a month — her own calculation, done from real data.
 *
 * Amie, 30 Sep: "Boo has 3 kids per 60 mins class, they pay £30.60 a month each… minus 1% booking
 * fee and 1.5% Stripe fee + 20p… then minus the hall hire from the profit or loss."
 *
 * So, per franchise, per month:
 *
 *     money in, after Stripe's fee and the Nullshift 1%     (from the ledger — what really arrived)
 *   + class passes used at the franchise's classes          (see below)
 *   − hall hire for every session                           (venue's hourly rate × class length)
 *   = profit or loss
 *
 * and then, in Amie's words (30 Sep): "they get 70% profit and [I] get 30%" — head office keeps
 * franchises.share_percent (30) of a PROFIT and the franchisee is paid the rest. "If they make a
 * loss, I absorb it and start fresh next month" — a loss pays out £0, head office absorbs it, and
 * nothing carries into the next month.
 *
 * Money in is what actually reached the studio's Stripe account in that London month, with Stripe's
 * real fee — Louis's call, 30 Sep. A family whose payment failed is not paid out on.
 *
 * CLASS PASSES are bought up front and aren't tied to a venue, so the turnover report files the
 * purchase under head office. For a payout that would be wrong: most of Brad's and Ella's adult
 * classes are paid by pass. So each pass session used at a franchise class that month is credited
 * to that class at the pass's own rate — price ÷ sessions, less the same share of fees the purchase
 * really paid.
 *
 * HALL HIRE is charged for every session, at the session's own times — cancelled ones too: "if
 * cancelled session, we still pay hall hire" (Amie). The one exception is a class that has been
 * taken down altogether: cancel-class marks every future session cancelled, and the hall is not
 * booked for a class that no longer runs, so a retired class's cancelled sessions are not charged.
 * Two classes at one venue on one date never pay for the same minutes twice. A venue with only a
 * daily rate pays it once per date used. A venue with no rate at all is flagged, never silently
 * charged £0.
 *
 * COACH PAY is the franchisee's own business: "Brad would pay Kayleigh out of his money" (Amie). So
 * nothing about coaches appears here.
 */
import { poundsToPence } from "./money";
import type { ReportRow, Totals } from "./revenueReport";

export type PayoutFranchise = {
  id: string;
  name: string;
  franchiseeName: string | null;
  /** Head office's share of a profit, in percent. */
  sharePercent: number;
};

/** Amie's standard terms: the franchisee keeps 70% of a profit, head office 30%. */
export const DEFAULT_SHARE_PERCENT = 30;
export type PayoutVenue = {
  id: string;
  name: string;
  franchiseId: string | null;
  hirePerHour: number | string | null;
  hirePerDay: number | string | null;
};
export type PayoutClass = {
  id: string;
  name: string;
  venueId: string | null;
  startTime: string | null;
  endTime: string | null;
  /** False once the class has been taken down; its cancelled sessions then cost nothing. */
  isActive?: boolean | null;
};
export type PayoutSession = {
  classId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
};
export type PassUse = {
  classId: string;
  /** What the whole pass cost, in pounds. */
  passPrice: number | string | null;
  passSessions: number;
  /** net ÷ gross of the payment that bought it, from the ledger. Null if it hasn't been synced. */
  netRatio: number | null;
};

export type ClassPayout = {
  id: string;
  name: string;
  payments: number;
  moneyIn: Totals;
  passSessions: number;
  passCreditPence: number;
  sessionsHeld: number;
  /** Cancelled, but the hall was still paid for. */
  sessionsCancelled: number;
  hireMinutes: number;
  hirePence: number;
  profitPence: number;
};
export type VenuePayout = {
  id: string;
  name: string;
  hireRate: string;
  missingRate: boolean;
  classes: ClassPayout[];
  /** Money at the venue that isn't tied to one class — a camp, a class since deleted. */
  otherMoneyIn: Totals;
  totals: PayoutTotals;
};
export type PayoutTotals = {
  grossPence: number;
  stripeFeePence: number;
  platformFeePence: number;
  netPence: number;
  passCreditPence: number;
  passSessions: number;
  hirePence: number;
  sessionsHeld: number;
  sessionsCancelled: number;
  hireMinutes: number;
  profitPence: number;
};
export type FranchisePayout = {
  franchise: PayoutFranchise;
  venues: VenuePayout[];
  totals: PayoutTotals;
  /** Head office's share of a profit. 0 in a loss month. */
  sharePence: number;
  /** What the franchisee is paid. Never negative. */
  payoutPence: number;
  /** A loss head office absorbs. 0 in a profitable month. */
  absorbedPence: number;
  /** Some pass purchases aren't in the ledger yet, so their fees are unknown and weren't taken off. */
  passFeesUnknown: boolean;
};

const zeroTotals = (): Totals => ({ grossPence: 0, stripeFeePence: 0, platformFeePence: 0, netPence: 0 });
const zeroPayout = (): PayoutTotals => ({
  grossPence: 0, stripeFeePence: 0, platformFeePence: 0, netPence: 0,
  passCreditPence: 0, passSessions: 0, hirePence: 0, sessionsHeld: 0, sessionsCancelled: 0, hireMinutes: 0, profitPence: 0,
});
const num = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** "17:45" or "17:45:00" → minutes past midnight. Null if it can't be read. */
export function minutesOf(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export type HireLine = { sessions: number; cancelled: number; minutes: number; pence: number };

/**
 * Hall hire per class, for the sessions given (already limited to one month).
 *
 * Sessions are grouped by venue and date and walked in start order; each is charged only for the
 * minutes no earlier session that day has already paid for. A cancelled session is charged like any
 * other unless its class has been taken down. Returns a line per class (`sessions` held,
 * `cancelled` but charged), and the venues that have no rate at all.
 */
export function hallHire(
  sessions: PayoutSession[],
  classes: Map<string, PayoutClass>,
  venues: Map<string, PayoutVenue>,
): { byClass: Map<string, HireLine>; missingRate: Set<string> } {
  const byClass = new Map<string, HireLine>();
  const missingRate = new Set<string>();
  const line = (id: string) => {
    let l = byClass.get(id);
    if (!l) { l = { sessions: 0, cancelled: 0, minutes: 0, pence: 0 }; byClass.set(id, l); }
    return l;
  };

  const days = new Map<string, { classId: string; start: number; end: number }[]>();
  for (const s of sessions) {
    const cls = classes.get(s.classId);
    if (!cls?.venueId) continue;
    const cancelled = s.status === "cancelled";
    if (cancelled && cls.isActive === false) continue;
    const start = minutesOf(s.startTime) ?? minutesOf(cls.startTime);
    const end = minutesOf(s.endTime) ?? minutesOf(cls.endTime);
    if (cancelled) line(s.classId).cancelled++;
    else line(s.classId).sessions++;
    if (start === null || end === null || end <= start) continue;
    const key = `${cls.venueId}|${s.date}`;
    const list = days.get(key) ?? [];
    list.push({ classId: s.classId, start, end });
    days.set(key, list);
  }

  for (const [key, list] of days) {
    const venueId = key.slice(0, key.indexOf("|"));
    const venue = venues.get(venueId);
    const perHour = num(venue?.hirePerHour);
    const perDay = num(venue?.hirePerDay);
    if (perHour === null && perDay === null) missingRate.add(venueId);

    list.sort((a, b) => a.start - b.start || a.end - b.end || a.classId.localeCompare(b.classId));
    let coveredUntil = -1;
    list.forEach((s, i) => {
      const from = Math.max(s.start, coveredUntil);
      const minutes = Math.max(0, s.end - from);
      coveredUntil = Math.max(coveredUntil, s.end);
      const l = line(s.classId);
      l.minutes += minutes;
      if (perHour !== null) l.pence += Math.round((perHour * 100 * minutes) / 60);
      else if (perDay !== null && i === 0) l.pence += Math.round(perDay * 100);
    });
  }
  return { byClass, missingRate };
}

/** What one pass session is worth to the class it was used at, in pence, after fees. */
export function passSessionPence(use: PassUse): { pence: number; feesKnown: boolean } {
  const sessions = Math.max(1, Math.round(use.passSessions || 0));
  const gross = poundsToPence(use.passPrice) / sessions;
  if (use.netRatio === null || !Number.isFinite(use.netRatio)) return { pence: Math.round(gross), feesKnown: false };
  return { pence: Math.round(gross * use.netRatio), feesKnown: true };
}

function hireRateLabel(v: PayoutVenue): string {
  const perHour = num(v.hirePerHour);
  const perDay = num(v.hirePerDay);
  if (perHour !== null) return `£${perHour.toFixed(2)} an hour`;
  if (perDay !== null) return `£${perDay.toFixed(2)} a day`;
  return "No hire rate set";
}

function addInto(t: PayoutTotals, c: { moneyIn: Totals; passCreditPence: number; passSessions: number; hirePence: number; sessionsHeld: number; sessionsCancelled: number; hireMinutes: number }) {
  t.grossPence += c.moneyIn.grossPence;
  t.stripeFeePence += c.moneyIn.stripeFeePence;
  t.platformFeePence += c.moneyIn.platformFeePence;
  t.netPence += c.moneyIn.netPence;
  t.passCreditPence += c.passCreditPence;
  t.passSessions += c.passSessions;
  t.hirePence += c.hirePence;
  t.sessionsHeld += c.sessionsHeld;
  t.sessionsCancelled += c.sessionsCancelled;
  t.hireMinutes += c.hireMinutes;
  t.profitPence = t.netPence + t.passCreditPence - t.hirePence;
}

export function buildPayouts(input: {
  franchises: PayoutFranchise[];
  venues: PayoutVenue[];
  classes: PayoutClass[];
  sessions: PayoutSession[];
  passUses: PassUse[];
  revenue: ReportRow[];
}): FranchisePayout[] {
  const venues = new Map(input.venues.map((v) => [v.id, v]));
  const classes = new Map(input.classes.map((c) => [c.id, c]));
  const { byClass: hire, missingRate } = hallHire(input.sessions, classes, venues);

  const out: FranchisePayout[] = [];
  for (const franchise of input.franchises) {
    const myVenues = input.venues.filter((v) => v.franchiseId === franchise.id);
    const venueIds = new Set(myVenues.map((v) => v.id));
    let passFeesUnknown = false;

    const venuePayouts: VenuePayout[] = myVenues.map((venue) => {
      const lines = new Map<string, ClassPayout>();
      const lineFor = (id: string, fallbackName: string | null) => {
        let l = lines.get(id);
        if (!l) {
          l = {
            id,
            name: classes.get(id)?.name ?? fallbackName ?? "Class",
            payments: 0, moneyIn: zeroTotals(), passSessions: 0, passCreditPence: 0,
            sessionsHeld: 0, sessionsCancelled: 0, hireMinutes: 0, hirePence: 0, profitPence: 0,
          };
          lines.set(id, l);
        }
        return l;
      };
      const otherMoneyIn = zeroTotals();

      for (const r of input.revenue) {
        if (r.venue_id !== venue.id) continue;
        const t = r.class_id ? lineFor(r.class_id, r.class_name).moneyIn : otherMoneyIn;
        t.grossPence += Number(r.gross_pence) || 0;
        t.stripeFeePence += Number(r.stripe_fee_pence) || 0;
        t.platformFeePence += Number(r.platform_fee_pence) || 0;
        t.netPence += Number(r.net_pence) || 0;
        if (r.class_id) lineFor(r.class_id, r.class_name).payments += Number(r.payment_count) || 0;
      }

      for (const use of input.passUses) {
        if (classes.get(use.classId)?.venueId !== venue.id) continue;
        const { pence, feesKnown } = passSessionPence(use);
        if (!feesKnown) passFeesUnknown = true;
        const l = lineFor(use.classId, null);
        l.passSessions++;
        l.passCreditPence += pence;
      }

      for (const [classId, h] of hire) {
        if (classes.get(classId)?.venueId !== venue.id) continue;
        const l = lineFor(classId, null);
        l.sessionsHeld = h.sessions;
        l.sessionsCancelled = h.cancelled;
        l.hireMinutes = h.minutes;
        l.hirePence = h.pence;
      }

      for (const l of lines.values()) {
        l.profitPence = l.moneyIn.netPence + l.passCreditPence - l.hirePence;
      }

      const classList = [...lines.values()].sort(
        (a, b) => (minutesOf(classes.get(a.id)?.startTime) ?? 0) - (minutesOf(classes.get(b.id)?.startTime) ?? 0) || a.name.localeCompare(b.name),
      );
      const totals = zeroPayout();
      classList.forEach((c) => addInto(totals, c));
      addInto(totals, { moneyIn: otherMoneyIn, passCreditPence: 0, passSessions: 0, hirePence: 0, sessionsHeld: 0, sessionsCancelled: 0, hireMinutes: 0 });

      return {
        id: venue.id,
        name: venue.name,
        hireRate: hireRateLabel(venue),
        missingRate: missingRate.has(venue.id) || (num(venue.hirePerHour) === null && num(venue.hirePerDay) === null),
        classes: classList,
        otherMoneyIn,
        totals,
      };
    });

    if (!venueIds.size) continue;
    const totals = zeroPayout();
    venuePayouts.forEach((v) => addInto(totals, { ...v.totals, moneyIn: v.totals }));
    const pct = Math.min(100, Math.max(0, Number(franchise.sharePercent) || 0));
    const profit = totals.profitPence;
    // Share and payout are split from the same whole, so the two always add back to the profit.
    const sharePence = profit > 0 ? Math.round((profit * pct) / 100) : 0;
    out.push({
      franchise,
      venues: venuePayouts,
      totals,
      sharePence,
      payoutPence: profit > 0 ? profit - sharePence : 0,
      absorbedPence: profit < 0 ? -profit : 0,
      passFeesUnknown,
    });
  }
  return out;
}

/** The statement as spreadsheet rows, for Amie to send on. */
export const PAYOUT_CSV_HEADER = [
  "Venue", "Class", "Payments", "Taken", "Stripe fees", "Nullshift fee", "Money in",
  "Pass sessions", "Pass credit", "Sessions held", "Cancelled (hall still paid)", "Hall hours", "Hall hire", "Profit / loss",
];

/** Money as a number of pounds, so the spreadsheet can add it up and a loss stays negative. */
const pounds = (p: number) => Math.round(p) / 100;
const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export function payoutCsvRows(p: FranchisePayout): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const v of p.venues) {
    for (const c of v.classes) {
      rows.push([
        v.name, c.name, c.payments, pounds(c.moneyIn.grossPence), pounds(c.moneyIn.stripeFeePence),
        pounds(c.moneyIn.platformFeePence), pounds(c.moneyIn.netPence), c.passSessions, pounds(c.passCreditPence),
        c.sessionsHeld, c.sessionsCancelled, hours(c.hireMinutes), pounds(c.hirePence), pounds(c.profitPence),
      ]);
    }
    if (v.otherMoneyIn.grossPence || v.otherMoneyIn.netPence) {
      rows.push([
        v.name, "Camps and other", "", pounds(v.otherMoneyIn.grossPence), pounds(v.otherMoneyIn.stripeFeePence),
        pounds(v.otherMoneyIn.platformFeePence), pounds(v.otherMoneyIn.netPence), "", "", "", "", "", "", pounds(v.otherMoneyIn.netPence),
      ]);
    }
  }
  const t = p.totals;
  rows.push([]);
  rows.push([
    "Total", "", "", pounds(t.grossPence), pounds(t.stripeFeePence), pounds(t.platformFeePence), pounds(t.netPence),
    t.passSessions, pounds(t.passCreditPence), t.sessionsHeld, t.sessionsCancelled, hours(t.hireMinutes), pounds(t.hirePence), pounds(t.profitPence),
  ]);
  const who = p.franchise.franchiseeName ?? p.franchise.name;
  const pct = Number(p.franchise.sharePercent) || 0;
  const last = (label: string, value: number) => [label, "", "", "", "", "", "", "", "", "", "", "", "", value];
  if (p.absorbedPence > 0) {
    rows.push(last("Loss absorbed by head office", pounds(p.absorbedPence)));
  } else {
    rows.push(last(`Head office share (${pct}% of profit)`, pounds(-p.sharePence) || 0));
  }
  rows.push(last(p.absorbedPence > 0 ? `Payout to ${who}` : `Payout to ${who} (${100 - pct}% of profit)`, pounds(p.payoutPence)));
  return rows;
}
