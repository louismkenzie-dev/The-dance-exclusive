// Mirror of src/lib/siblingDrop.ts — KEEP THE TWO IN SYNC.
// siblingDrop.test.ts fails if they ever disagree.
//
/**
 * When a child leaves, the family's sibling discount may have to go.
 *
 * Louis, 3 Oct: "drop the sibling discount when a child is removed from a family booking". The
 * 10% comes from the checkout rule in pricing.ts: the family's highest-spending child pays full
 * price and every other child gets 10% off. Nothing ever re-applied that rule when a child left, so
 * a family whose full-price child stopped kept every remaining discount indefinitely.
 *
 * This module decides — and only decides — which of the remaining memberships should go back to
 * full price. It is deliberately conservative, because it raises what a family pays:
 *
 *   - It only ever RAISES a price, and only from an amount that exactly matches today's
 *     discounted price for that class back to that class's full price. A price it can't read
 *     (set under an older price list, or adjusted by hand) is never touched; it is reported so
 *     Amie can look.
 *   - It never adds a discount, and never leaves the family with more than one full-price child.
 *   - A child who still dances with the family some other way — another membership, or a term,
 *     class or camp still to come — still counts as a sibling, exactly as checkout would count
 *     them, so nobody loses a discount while a brother or sister is still in class.
 *   - A membership that is itself ending (cancel_scheduled) keeps its final price.
 */
import { priceMonthlyItems, round2, SIBLING_DISCOUNT } from "./pricing.ts";

export const LIVE_MEMBERSHIP_STATUSES = ["active", "past_due", "paused", "cancel_scheduled"];
/** Statuses whose price may be changed. A membership already ending keeps its final payment. */
const UPDATABLE = new Set(["active", "past_due", "paused"]);

export type FamilyMembership = {
  id: string;
  studentId: string | null;
  isSelfStudent: boolean;
  classId: string;
  classType: "children" | "adult";
  siblingDiscountEnabled: boolean;
  /** Today's first-class monthly price for this class. */
  fullMonthly: number;
  /** Today's additional-class monthly price for this class. */
  additionalMonthly: number;
  /** What the membership is billed now. */
  monthlyAmount: number;
  status: string;
};

export type PriceRaise = { membershipId: string; studentId: string; from: number; to: number };

export type SiblingDropPlan = {
  raises: PriceRaise[];
  /** Discounted-looking memberships left alone because their price couldn't be read safely. */
  unclear: { membershipId: string; studentId: string | null; amount: number }[];
  /** Why nothing (or something) changed, in plain words, for logs and for Amie. */
  reason: string;
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** The price a class is billed at with the 10% sibling discount taken off — checkout's own rounding. */
export function discountedPrice(base: number): number {
  return round2(base - round2(base * SIBLING_DISCOUNT));
}

type ItemRead = { state: "full" | "discounted" | "unknown"; base: number | null };

/**
 * Is this membership billed at full price, at the discounted price, or neither?
 *
 * A child's classes are matched against every price that class could legitimately carry — the
 * first-class rate, the additional-class rate, or what the £110 cap leaves — because which class
 * counts as "first" depends on the order they were booked in. (For two classes it makes no
 * difference to the child's total: £27.20 + £26.35 and £30.60 + £22.95 are both £53.55.)
 */
export function readItemPrice(m: FamilyMembership, recomputedBase: number | null): ItemRead {
  const candidates = [m.fullMonthly, m.additionalMonthly, recomputedBase]
    .filter((c): c is number => c != null && Number.isFinite(c) && c > 0);
  const full = candidates.find((c) => near(m.monthlyAmount, c));
  if (full != null) return { state: "full", base: full };
  const discounted = candidates.find((c) => near(m.monthlyAmount, discountedPrice(c)));
  if (discounted != null) return { state: "discounted", base: discounted };
  return { state: "unknown", base: null };
}

/**
 * Plan the price rises after a child has left.
 *
 * `remaining` is every live membership the family still holds, on any subscription, AFTER the
 * leaving child's last one has ended. `stillDancingElsewhere` is the family's children who are
 * still in class through a non-monthly booking (see `childrenStillDancing`).
 */
export function planSiblingDiscountDrop(
  remaining: FamilyMembership[],
  stillDancingElsewhere: string[],
): SiblingDropPlan {
  const none = (reason: string): SiblingDropPlan => ({ raises: [], unclear: [], reason });

  const live = remaining.filter((m) => LIVE_MEMBERSHIP_STATUSES.includes(m.status));
  const children = live.filter((m) => m.classType === "children" && m.studentId && !m.isSelfStudent);

  // Today's base price for each of a child's classes, all of that child's classes together.
  const bases = priceMonthlyItems(
    children.map((m) => ({
      id: m.id,
      classId: m.classId,
      studentId: m.studentId,
      fullMonthly: m.fullMonthly,
      additionalMonthly: m.additionalMonthly,
    })),
  );

  // Only classes that carry a sibling discount, and aren't free under the cap, say anything.
  const priced = children.filter((m) => m.siblingDiscountEnabled && m.monthlyAmount > 0);
  if (priced.length === 0) return none("No remaining memberships carry a sibling discount.");

  const reads = new Map(priced.map((m) => [m.id, readItemPrice(m, bases.get(m.id) ?? null)]));
  const byChild = new Map<string, FamilyMembership[]>();
  for (const m of priced) {
    const list = byChild.get(m.studentId as string) ?? [];
    list.push(m);
    byChild.set(m.studentId as string, list);
  }

  // Somebody else is still dancing with the family — the remaining children are still siblings.
  // That includes a child whose only class has the sibling discount switched off: checkout counts
  // them too, because their membership's booking is a confirmed booking.
  const otherChildren = new Set([...stillDancingElsewhere, ...children.map((m) => m.studentId as string)]);
  const elsewhere = [...otherChildren].filter((id) => !byChild.has(id));
  if (elsewhere.length > 0) return none("Another child is still dancing with the family, so the sibling discount stays.");

  const childState = (id: string) => {
    const states = new Set((byChild.get(id) ?? []).map((m) => reads.get(m.id)!.state));
    return states.size === 1 ? [...states][0] : "mixed";
  };

  const unclearOf = (ms: FamilyMembership[]) =>
    ms.filter((m) => reads.get(m.id)!.state === "unknown")
      .map((m) => ({ membershipId: m.id, studentId: m.studentId, amount: m.monthlyAmount }));

  const raisesFor = (id: string): PriceRaise[] =>
    (byChild.get(id) ?? [])
      .filter((m) => UPDATABLE.has(m.status) && reads.get(m.id)!.state === "discounted")
      .map((m) => ({ membershipId: m.id, studentId: id, from: m.monthlyAmount, to: reads.get(m.id)!.base as number }));

  const ids = [...byChild.keys()];

  // One child left: they have no sibling, so every discount they carry goes.
  if (ids.length === 1) {
    const [only] = ids;
    const raises = raisesFor(only);
    const unclear = unclearOf(byChild.get(only)!);
    return {
      raises,
      unclear,
      reason: raises.length
        ? "Only one child is left dancing, so their sibling discount has ended."
        : unclear.length
          ? "Only one child is left, but their price doesn't match today's price list — check it by hand."
          : childState(only) === "full"
            ? "The remaining child already pays full price."
            : "The remaining child's membership is ending too, so its final price stays.",
    };
  }

  // Several children left. One of them is already the full-price child: nothing to do.
  if (ids.some((id) => childState(id) === "full")) return none("One of the remaining children already pays full price.");

  // A price we can't read could be the full-price child. Don't guess — ask.
  const unreadable = ids.filter((id) => childState(id) !== "discounted");
  if (unreadable.length > 0) {
    return {
      raises: [],
      unclear: unreadable.flatMap((id) => unclearOf(byChild.get(id)!)),
      reason: "The full-price child has left, but a remaining price doesn't match today's price list — check it by hand.",
    };
  }

  // Everyone left is discounted: the highest-spending child becomes the full-price one, as at
  // checkout. A child whose membership is already ending keeps their final price, so pick from the
  // children whose price can change.
  const updatable = ids.filter((id) => (byChild.get(id) ?? []).every((m) => UPDATABLE.has(m.status)));
  if (updatable.length === 0) return none("The remaining memberships are all ending, so their final prices stay.");
  const spend = (id: string) =>
    round2((byChild.get(id) ?? []).reduce((s, m) => s + (reads.get(m.id)!.base ?? 0), 0));
  const [first] = [...updatable].sort((a, b) => spend(b) - spend(a) || a.localeCompare(b));
  return {
    raises: raisesFor(first),
    unclear: [],
    reason: "The full-price child has left, so the next child up now pays full price.",
  };
}

export type FamilyBooking = {
  studentId: string | null;
  isSelfStudent: boolean;
  bookingType: string;
  status: string;
  notes: string | null;
  /** The class's term_end, for a term or yearly booking. */
  classTermEnd: string | null;
  /** The camp's end_date, for a camp booking. */
  campEndDate: string | null;
};

/**
 * The family's children still in class through something other than a monthly membership: a
 * class, trial or pass night still to come, a term or year still running, or a camp still ahead.
 *
 * Checkout counts any confirmed booking a child has ever had — fine for a new booking, wrong for
 * deciding whether a child has left, because a trial from July would keep a discount alive
 * forever. So here a booking only counts while it is still current.
 */
export function childrenStillDancing(bookings: FamilyBooking[], todayIso: string): string[] {
  const today = todayIso.slice(0, 10);
  const out = new Set<string>();
  for (const b of bookings) {
    if (b.status !== "confirmed" || !b.studentId || b.isSelfStudent || b.bookingType === "monthly") continue;
    const dated = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes ?? "")?.[1] ?? null;
    let current = false;
    if (dated) current = dated >= today;
    else if (b.bookingType === "term" || b.bookingType === "yearly") current = !!b.classTermEnd && b.classTermEnd.slice(0, 10) >= today;
    else if (b.bookingType === "camp") current = !!b.campEndDate && b.campEndDate.slice(0, 10) >= today;
    if (current) out.add(b.studentId);
  }
  return [...out];
}
