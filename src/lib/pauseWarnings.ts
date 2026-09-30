/**
 * Warnings about paused memberships.
 *
 * A pause voids invoices while it runs and then COLLECTION RESUMES AUTOMATICALLY. That is correct
 * for the case it was built for — Brooke George, paused October after a seizure — and quietly
 * wrong when a pause has been used to mean "they've left": the family gets billed again months
 * later for a child who no longer attends. Poppy Beatwell was paused until 5 Jan 2027 with the
 * reason "Leaving", which would have charged £30.60 on that date.
 *
 * So two different warnings:
 *
 *   1. A pause is about to resume. Operational, useful either way.
 *   2. A pause whose reason reads like a cancellation. Flagged whenever it is spotted, not when
 *      it bills, which is the whole point — Poppy surfaces 99 days early instead of the day after.
 */

/** Words a reason contains when the family has actually gone. */
const LEAVING = /\b(leav\w*|left|quit\w*|quitting|not returning|no longer|stopp?\w*|finish\w*|ended|withdraw\w*)\b/i;

export type PausedMembershipRow = {
  membershipId: string;
  /** The family, so one household is one warning however many memberships they hold. */
  userId: string | null;
  dancerName: string | null;
  /** ISO date the pause ends and billing restarts. */
  pausedUntil: string | null;
  pauseReason: string | null;
  monthlyAmount: number | null;
};

export type PauseWarning = {
  key: string;
  dancerNames: string[];
  pausedUntil: string;
  reason: string | null;
  /** Combined monthly charge that will restart for this family on that date. */
  totalMonthly: number;
  membershipCount: number;
  daysUntil: number;
  /** The reason reads like the family has left, so this should have been a cancellation. */
  looksLikeCancellation: boolean;
};

/**
 * Reasons are typed by hand and some were stored wrapped in literal quote marks
 * (`"Brooke has had a seizure…"`), so strip those before showing or matching.
 */
export function cleanReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const trimmed = reason.trim().replace(/^["']+|["']+$/g, "").trim();
  return trimmed || null;
}

/**
 * Does this reason mean "they've left" rather than "they're coming back"?
 *
 * Deliberately conservative: it flags for a second look, it does not change anything on its own.
 * A medical pause must not match, because telling Amie that Brooke looks like a leaver is both
 * wrong and unkind.
 */
export function looksLikeCancellation(reason: string | null | undefined): boolean {
  const clean = cleanReason(reason);
  if (!clean) return false;
  return LEAVING.test(clean);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * One warning per family per resume date.
 *
 * Brooke holds SEVEN memberships sharing a reason and a date. Ungrouped that is seven identical
 * lines on the dashboard — the same duplicate-warning problem already fixed for Public Liability
 * Insurance on this screen. Grouped, it is one line with the real total.
 */
export function groupPauseWarnings(
  rows: PausedMembershipRow[],
  todayIso: string,
): PauseWarning[] {
  const byFamily = new Map<string, PauseWarning>();

  for (const r of rows) {
    if (!r.pausedUntil) continue;
    const date = r.pausedUntil.slice(0, 10);
    const key = `${r.userId ?? r.membershipId}:${date}`;
    const name = (r.dancerName ?? "").trim();
    const amount = Number(r.monthlyAmount) || 0;

    const existing = byFamily.get(key);
    if (existing) {
      if (name && !existing.dancerNames.includes(name)) existing.dancerNames.push(name);
      existing.totalMonthly += amount;
      existing.membershipCount += 1;
      // Any one membership reading as a leaver marks the whole family's warning.
      existing.looksLikeCancellation ||= looksLikeCancellation(r.pauseReason);
      existing.reason ??= cleanReason(r.pauseReason);
    } else {
      byFamily.set(key, {
        key,
        dancerNames: name ? [name] : [],
        pausedUntil: date,
        reason: cleanReason(r.pauseReason),
        totalMonthly: amount,
        membershipCount: 1,
        daysUntil: daysBetween(todayIso, date),
        looksLikeCancellation: looksLikeCancellation(r.pauseReason),
      });
    }
  }

  return [...byFamily.values()]
    .map((w) => ({ ...w, dancerNames: [...w.dancerNames].sort() }))
    .sort((a, b) => a.pausedUntil.localeCompare(b.pausedUntil));
}

/** Round to pennies — summing several memberships in floats otherwise shows £83.05000000000001. */
export function totalMonthlyPounds(w: PauseWarning): number {
  return Math.round(w.totalMonthly * 100) / 100;
}

/**
 * Which warnings belong on the dashboard today: anything resuming within `withinDays`, plus
 * anything that reads like a cancellation whatever its date.
 */
export function dueWarnings(warnings: PauseWarning[], withinDays = 21): PauseWarning[] {
  return warnings.filter((w) => w.looksLikeCancellation || w.daysUntil <= withinDays);
}

/**
 * The dashboard line. `when` is the already-formatted date, passed in so the date sits with
 * "restarts" rather than being appended after the reason — "Reason given: Leaving on 5 Jan"
 * reads as though the reason was given in January.
 */
export function describeWarning(w: PauseWarning, when: string): string {
  const who = w.dancerNames.length ? w.dancerNames.join(" & ") : "A family";
  const amount = `£${totalMonthlyPounds(w).toFixed(2)}`;
  if (w.looksLikeCancellation) {
    const reason = w.reason ? ` Reason given: “${w.reason}”.` : "";
    return `${who}: paused, not cancelled — ${amount}/month restarts ${when}.${reason} Cancel it instead?`;
  }
  return `${who}: paused payments of ${amount}/month restart ${when}`;
}

export type PausedSummary = {
  /** Paused for the family's annual free month: no `paused_until`, resumed by the maintenance job. */
  freeMonthCount: number;
  /** Pauses the studio agreed, one line per family per restart date. */
  studio: PauseWarning[];
};

/**
 * Every paused membership, split the way memberships-maintenance tells them apart.
 *
 * The Bookings page used to call every paused membership "paused for the August break … resumes
 * on 1 September" — true when that was the only kind of pause, and still printed on 30 September
 * about Brooke's medical pause and Poppy's "Leaving" one, which restart in November and January.
 */
export function summarisePaused(
  rows: (PausedMembershipRow & { status: string })[],
  todayIso: string,
): PausedSummary {
  const paused = rows.filter((r) => r.status === "paused");
  return {
    freeMonthCount: paused.filter((r) => !r.pausedUntil).length,
    studio: groupPauseWarnings(paused.filter((r) => !!r.pausedUntil), todayIso),
  };
}
