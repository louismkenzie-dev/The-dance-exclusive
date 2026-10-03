import { describe, expect, it } from "vitest";
import { applySiblingDiscountDrop } from "../../supabase/functions/_shared/applySiblingDrop.ts";
import { renderMembershipEnded } from "../../supabase/functions/_shared/email-templates/membership-ended.ts";

/**
 * The part that writes to Stripe, run against fakes: which prices are created, which subscription
 * items change (never with proration), and what the membership rows end up saying.
 */

type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>) {
  const updates: { table: string; values: Row; id: string }[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let pendingUpdate: Row | null = null;
    // A chainable stand-in for the query builder: just enough of it for applySiblingDiscountDrop.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real builder is untyped here too
    const q: any = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        if (pendingUpdate && col === "id") {
          updates.push({ table, values: pendingUpdate, id: String(val) });
          return Promise.resolve({ error: null });
        }
        rows = rows.filter((r) => r[col] === undefined || r[col] === val);
        return q;
      },
      neq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] !== val); return q; },
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return q; },
      not: () => q,
      update: (values: Row) => { pendingUpdate = values; return q; },
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
    };
    return q;
  };
  return { client: { from }, updates };
}

function fakeStripe() {
  const calls: { op: string; args: unknown[] }[] = [];
  let n = 0;
  return {
    calls,
    client: {
      prices: { create: async (...args: unknown[]) => { calls.push({ op: "prices.create", args }); return { id: `price_${++n}` }; } },
      subscriptionItems: { update: async (...args: unknown[]) => { calls.push({ op: "subscriptionItems.update", args }); return {}; } },
      subscriptions: { retrieve: async () => ({ current_period_end: Date.parse("2026-11-05T07:00:00Z") / 1000 }) },
    },
  };
}

const SIXTY_MIN = {
  class_type: "children", start_time: "17:00:00", end_time: "18:00:00", price_per_session: 9,
  price_per_term: null, price_per_month: null, price_per_year: null, sibling_discount_enabled: true,
};

const base = (memberships: Row[], bookings: Row[] = []) => ({
  memberships,
  classes: [{ id: "c1", name: "Mixed Street", ...SIXTY_MIN }, { id: "c2", name: "Mini Street", ...SIXTY_MIN }],
  students: [
    { id: "s-brooke", first_name: "Brooke", last_name: "Sample", is_self: false },
    { id: "s-alfie", first_name: "Alfie", last_name: "Sample", is_self: false },
  ],
  bookings,
});

const opts = { userId: "u1", leavingStudentId: "s-alfie", env: "live", todayIso: "2026-10-03T10:00:00Z" };

describe("applySiblingDiscountDrop", () => {
  it("raises the child left on their own back to full price, with no proration", async () => {
    const db = fakeSupabase(base([
      { id: "m-brooke", user_id: "u1", stripe_env: "live", student_id: "s-brooke", class_id: "c1", monthly_amount: 27.54,
        status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_1" },
    ]));
    const stripe = fakeStripe();
    const r = await applySiblingDiscountDrop(db.client, stripe.client, {}, opts);

    expect(r.changes).toEqual([{
      studentName: "Brooke Sample", className: "Mixed Street", from: 27.54, to: 30.6,
      nextPaymentDate: "2026-11-05T07:00:00.000Z",
    }]);
    const [create, update] = stripe.calls;
    expect((create.args[0] as { unit_amount: number }).unit_amount).toBe(3060);
    expect(update.args[0]).toBe("si_1");
    expect(update.args[1]).toEqual({ price: "price_1", proration_behavior: "none" });
    expect(db.updates).toEqual([
      { table: "memberships", id: "m-brooke", values: expect.objectContaining({ monthly_amount: 30.6, stripe_price_id: "price_1" }) },
    ]);
  });

  it("changes nothing while the leaving child still has another monthly class", async () => {
    const db = fakeSupabase(base([
      { id: "m-brooke", user_id: "u1", stripe_env: "live", student_id: "s-brooke", class_id: "c1", monthly_amount: 27.54, status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_1" },
      { id: "m-alfie2", user_id: "u1", stripe_env: "live", student_id: "s-alfie", class_id: "c2", monthly_amount: 30.6, status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_2" },
    ]));
    const stripe = fakeStripe();
    const r = await applySiblingDiscountDrop(db.client, stripe.client, {}, opts);
    expect(r.changes).toEqual([]);
    expect(stripe.calls).toEqual([]);
  });

  it("changes nothing while the leaving child is still booked on a term", async () => {
    const db = fakeSupabase(base(
      [{ id: "m-brooke", user_id: "u1", stripe_env: "live", student_id: "s-brooke", class_id: "c1", monthly_amount: 27.54, status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_1" }],
      [{ parent_id: "u1", student_id: "s-alfie", booking_type: "term", status: "confirmed", notes: null, students: { is_self: false }, classes: { term_end: "2026-12-18" }, camps: null }],
    ));
    const stripe = fakeStripe();
    const r = await applySiblingDiscountDrop(db.client, stripe.client, {}, opts);
    expect(r.changes).toEqual([]);
    expect(stripe.calls).toEqual([]);
  });

  it("reports a price it can't read instead of changing it", async () => {
    const db = fakeSupabase(base([
      { id: "m-brooke", user_id: "u1", stripe_env: "live", student_id: "s-brooke", class_id: "c1", monthly_amount: 25, status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_1" },
    ]));
    const stripe = fakeStripe();
    const r = await applySiblingDiscountDrop(db.client, stripe.client, {}, opts);
    expect(r.changes).toEqual([]);
    expect(r.unclear).toEqual([{ studentName: "Brooke Sample", className: "Mixed Street", amount: 25 }]);
    expect(stripe.calls).toEqual([]);
  });

  it("records a failed Stripe update without throwing, and leaves the row alone", async () => {
    const db = fakeSupabase(base([
      { id: "m-brooke", user_id: "u1", stripe_env: "live", student_id: "s-brooke", class_id: "c1", monthly_amount: 27.54, status: "active", stripe_subscription_id: "sub_1", stripe_subscription_item_id: "si_1" },
    ]));
    const stripe = fakeStripe();
    stripe.client.subscriptionItems.update = async () => { throw new Error("card_declined"); };
    const r = await applySiblingDiscountDrop(db.client, stripe.client, {}, opts);
    expect(r.changes).toEqual([]);
    expect(r.failed).toEqual([{ studentName: "Brooke Sample", className: "Mixed Street", error: "card_declined" }]);
    expect(db.updates).toEqual([]);
  });

  it("does nothing when the ended membership names no child", async () => {
    const r = await applySiblingDiscountDrop(fakeSupabase(base([])).client, fakeStripe().client, {}, { ...opts, leavingStudentId: null });
    expect(r.changes).toEqual([]);
  });
});

describe("the membership-ended email", () => {
  it("tells the family the new price and when it starts", () => {
    const { html } = renderMembershipEnded({
      parentName: "Natalie Sample", studentName: "Alfie Sample", className: "Mini Street",
      endDate: "2026-11-05T07:00:00Z", scheduled: true,
      siblingPriceChanges: [{ studentName: "Brooke Sample", className: "Mixed Street", from: 27.54, to: 30.6, nextPaymentDate: "2026-11-05T07:00:00Z" }],
    });
    expect(html).toContain("sibling discount");
    expect(html).toContain("&pound;27.54");
    expect(html).toContain("&pound;30.60");
    expect(html).toContain("Thursday 5 November 2026");
  });

  it("says nothing about prices when nothing changed", () => {
    const { html } = renderMembershipEnded({ className: "Mini Street", endDate: "2026-11-05T07:00:00Z" });
    expect(html).not.toContain("sibling discount");
  });
});
