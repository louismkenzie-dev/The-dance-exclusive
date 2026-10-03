/**
 * Apply the sibling-discount rule after a child's last monthly class has ended.
 *
 * Called by manage-membership (Amie's "End now") and by memberships-maintenance (a notice period
 * running out) straight after a membership is ended. The decision is made by the pure, tested
 * planSiblingDiscountDrop in siblingDrop.ts; this file only fetches what it needs and writes the
 * result — a new Stripe price on each raised subscription item (no proration: the change applies
 * from the next payment) and the new amount on the membership row.
 *
 * It must never break the cancellation that called it. Callers wrap it; it also catches per-item
 * failures so one bad item doesn't stop the rest, and reports them.
 */
// deno-lint-ignore-file no-explicit-any
import { additionalMonthlyPrice, monthlyPrice } from "./pricing.ts";
import {
  childrenStillDancing,
  LIVE_MEMBERSHIP_STATUSES,
  planSiblingDiscountDrop,
  type FamilyBooking,
  type FamilyMembership,
} from "./siblingDrop.ts";

export type SiblingPriceChange = {
  studentName: string | null;
  className: string;
  from: number;
  to: number;
  /** When the new price is first taken (the subscription's next billing date). */
  nextPaymentDate: string | null;
};

export type SiblingDropResult = {
  changes: SiblingPriceChange[];
  /** Memberships whose price couldn't be read safely — for Amie to check by hand. */
  unclear: { studentName: string | null; className: string; amount: number }[];
  failed: { studentName: string | null; className: string; error: string }[];
  reason: string;
};

const CLASS_FIELDS =
  "id, name, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, sibling_discount_enabled";

export async function applySiblingDiscountDrop(
  supabase: any,
  stripe: any,
  connectOpts: any,
  opts: { userId: string; leavingStudentId: string | null; env: string; todayIso: string },
): Promise<SiblingDropResult> {
  const empty = (reason: string): SiblingDropResult => ({ changes: [], unclear: [], failed: [], reason });
  if (!opts.leavingStudentId) return empty("No child named on the membership that ended.");

  const { data: rows } = await supabase
    .from("memberships")
    .select("id, student_id, class_id, monthly_amount, status, stripe_subscription_id, stripe_subscription_item_id")
    .eq("user_id", opts.userId)
    .eq("stripe_env", opts.env)
    .in("status", LIVE_MEMBERSHIP_STATUSES);
  const family = (rows ?? []) as any[];

  // The child still has another class with the family: they haven't left.
  if (family.some((m) => m.student_id === opts.leavingStudentId)) {
    return empty("The child still has another monthly class, so nothing changes.");
  }
  if (family.length === 0) return empty("No other memberships in the family.");

  const classIds = [...new Set(family.map((m) => m.class_id).filter(Boolean))];
  const studentIds = [...new Set(family.map((m) => m.student_id).filter(Boolean))];
  const [{ data: classRows }, { data: studentRows }, { data: bookingRows }] = await Promise.all([
    classIds.length ? supabase.from("classes").select(CLASS_FIELDS).in("id", classIds) : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase.from("students").select("id, first_name, last_name, is_self").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("bookings")
      .select("student_id, booking_type, status, notes, students(is_self), classes(term_end), camps(end_date)")
      .eq("parent_id", opts.userId)
      .eq("status", "confirmed")
      .neq("booking_type", "monthly")
      .not("student_id", "is", null),
  ]);
  const classById = new Map<string, any>((classRows ?? []).map((c: any) => [c.id, c]));
  const studentById = new Map<string, any>((studentRows ?? []).map((s: any) => [s.id, s]));

  const members: FamilyMembership[] = family
    .filter((m) => m.class_id && classById.has(m.class_id))
    .map((m) => {
      const cls = classById.get(m.class_id);
      const student = m.student_id ? studentById.get(m.student_id) : null;
      return {
        id: m.id,
        studentId: m.student_id ?? null,
        isSelfStudent: Boolean(student?.is_self),
        classId: m.class_id,
        classType: (cls.class_type ?? "children") as "children" | "adult",
        siblingDiscountEnabled: cls.sibling_discount_enabled ?? true,
        fullMonthly: monthlyPrice(cls),
        additionalMonthly: additionalMonthlyPrice(cls),
        monthlyAmount: Number(m.monthly_amount),
        status: m.status,
      };
    });

  const bookings: FamilyBooking[] = (bookingRows ?? []).map((b: any) => ({
    studentId: b.student_id ?? null,
    isSelfStudent: Boolean(b.students?.is_self),
    bookingType: b.booking_type ?? "",
    status: b.status,
    notes: b.notes ?? null,
    classTermEnd: b.classes?.term_end ?? null,
    campEndDate: b.camps?.end_date ?? null,
  }));
  // The leaving child counts too, if they are still in class some other way (a term, a camp).
  const plan = planSiblingDiscountDrop(members, childrenStillDancing(bookings, opts.todayIso));

  const describe = (membershipId: string) => {
    const row = family.find((m) => m.id === membershipId);
    const cls = row ? classById.get(row.class_id) : null;
    const student = row?.student_id ? studentById.get(row.student_id) : null;
    return {
      row,
      studentName: student ? `${student.first_name} ${student.last_name}` : null,
      className: cls?.name ?? "Class",
    };
  };

  const result: SiblingDropResult = {
    changes: [],
    unclear: plan.unclear.map((u) => {
      const d = describe(u.membershipId);
      return { studentName: d.studentName, className: d.className, amount: u.amount };
    }),
    failed: [],
    reason: plan.reason,
  };

  const nextPayment = new Map<string, string | null>();
  for (const raise of plan.raises) {
    const d = describe(raise.membershipId);
    try {
      if (!d.row?.stripe_subscription_item_id) throw new Error("no Stripe subscription item on the membership");
      const price = await stripe.prices.create(
        {
          currency: "gbp",
          unit_amount: Math.round(raise.to * 100),
          recurring: { interval: "month" },
          product_data: {
            name: `${d.className} — Monthly Membership${d.studentName ? ` (${d.studentName})` : ""}`,
          },
        },
        connectOpts,
      );
      await stripe.subscriptionItems.update(
        d.row.stripe_subscription_item_id,
        { price: price.id, proration_behavior: "none" },
        connectOpts,
      );
      const { error } = await supabase
        .from("memberships")
        .update({ monthly_amount: raise.to, stripe_price_id: price.id, updated_at: new Date().toISOString() })
        .eq("id", raise.membershipId);
      if (error) throw error;

      const subId = d.row.stripe_subscription_id as string;
      if (!nextPayment.has(subId)) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId, {}, connectOpts);
          nextPayment.set(subId, sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null);
        } catch {
          nextPayment.set(subId, null);
        }
      }
      result.changes.push({
        studentName: d.studentName,
        className: d.className,
        from: raise.from,
        to: raise.to,
        nextPaymentDate: nextPayment.get(subId) ?? null,
      });
    } catch (e) {
      console.error("Sibling discount drop failed for membership", raise.membershipId, e);
      result.failed.push({ studentName: d.studentName, className: d.className, error: (e as Error)?.message ?? String(e) });
    }
  }
  return result;
}
