// Membership self-service:
//  - "cancel": one month's written notice. One more monthly payment is taken
//    on the next billing date (the "final payment"), the membership stays
//    active for the month that payment covers, then the Stripe subscription
//    ends automatically.
//  - "switch_class": move a rolling membership to a different weekly class
//    (e.g. Monday hip hop → Tuesday). The register updates immediately, the
//    subscription item is re-priced with the same rules as checkout
//    (additional-class rate, sibling discount, £110 unlimited cap) and the
//    next payment charges the new amount. A deliberate ongoing change — the
//    membership stays tied to one specific class, not week-by-week hopping.
//  - "adjust" (admin only): take an amount off (or add to) ONE month's
//    payment — "£7 off February because we owed them", or a whole month
//    free. Recorded in membership_adjustments and passed to Stripe as an
//    invoice item on that month's invoice, so the card is charged the
//    adjusted amount; the usual price carries on the month after.
//  - "remove_adjustment" (admin only): undo one before its invoice is raised.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import {
  additionalMonthlyPrice,
  computeSiblingDiscount,
  monthlyPrice,
  priceMonthlyItems,
  round2,
} from "../_shared/pricing.ts";
import {
  ensureAdjustmentInvoiceItem,
  markAdjustmentApplied,
  monthLabel,
  yearMonth,
} from "../_shared/membershipAdjustments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const addOneMonth = (unixSeconds: number): Date => {
  const d = new Date(unixSeconds * 1000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CLASS_FIELDS =
  "id, name, class_type, day_of_week, start_time, end_time, price_per_session, price_per_month, " +
  "is_active, status, publicly_visible, booking_enabled, invite_only, sibling_discount_enabled, " +
  "age_min, age_max, venues:venue_id ( name )";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "You must be signed in to manage a membership" }, 401);
    }

    const { action, membershipId, newClassId, billingMonth, amount, reason, adjustmentId } = await req.json();
    const ADMIN_ACTIONS = ["adjust", "remove_adjustment"];
    if (!["cancel", "switch_class", "payment_link", ...ADMIN_ACTIONS].includes(action)) {
      return jsonResponse({ error: "Unknown action" }, 400);
    }
    if (!membershipId || typeof membershipId !== "string") {
      return jsonResponse({ error: "No membership selected" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Owners manage their own memberships; admins (Amie moving a family who
    // booked the wrong class) can manage anyone's. Money adjustments are
    // admin-only.
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = Boolean(adminRole);
    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", membershipId)
      .maybeSingle();
    if (!membership) return jsonResponse({ error: "Membership not found" }, 404);
    if (membership.user_id !== user.id && !isAdmin) {
      return jsonResponse({ error: "Membership not found" }, 404);
    }
    if (ADMIN_ACTIONS.includes(action) && !isAdmin) {
      return jsonResponse({ error: "Only the studio can change a payment amount" }, 403);
    }
    // All family-scoped reads/writes below belong to the membership's OWNER,
    // which is the caller for parents and the family for admin calls.
    const ownerId: string = membership.user_id;
    if (membership.status === "cancelled") {
      return jsonResponse({ error: "This membership has already ended" }, 400);
    }
    if (membership.status === "incomplete") {
      return jsonResponse({ error: "This membership hasn't started yet" }, 400);
    }

    // The membership row records which Stripe environment its subscription
    // lives in — always use that, never a client-supplied value.
    const env: StripeEnv = membership.stripe_env === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    const sub = await stripe.subscriptions.retrieve(
      membership.stripe_subscription_id,
      {},
      connectOpts,
    );
    if (!sub || sub.status === "canceled") {
      // Stripe already ended it — sync our side.
      await supabase
        .from("memberships")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", membership.id);
      return jsonResponse({ error: "This membership has already ended" }, 400);
    }

    // ────────────────────────────────────────────────────────────────────
    // PAYMENT LINK — Stripe's hosted invoice page for a failed payment, so
    // the family can settle it right now (with a different card if needed).
    // ────────────────────────────────────────────────────────────────────
    if (action === "payment_link") {
      let payUrl: string | null = null;
      try {
        if (sub.latest_invoice) {
          const invoiceId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : (sub.latest_invoice as any).id;
          const invoice: any = await stripe.invoices.retrieve(invoiceId, {}, connectOpts);
          if (invoice?.status === "open") payUrl = invoice.hosted_invoice_url ?? null;
        }
      } catch (e) {
        console.error("Could not fetch hosted invoice:", e);
      }
      if (!payUrl) {
        return jsonResponse({ error: "There's nothing to pay right now — the payment may already have gone through." }, 400);
      }
      return jsonResponse({ url: payUrl });
    }

    // ────────────────────────────────────────────────────────────────────
    // ADJUST ONE MONTH'S PAYMENT (admin) — an invoice item on the chosen
    // month's subscription invoice. If that month is the next payment due,
    // it goes to Stripe right now; otherwise the daily maintenance job
    // passes it on once that month's payment becomes the next one.
    // ────────────────────────────────────────────────────────────────────
    const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
    const nextChargeYm = sub.current_period_end
      ? yearMonth(new Date(sub.current_period_end * 1000))
      : null;

    if (action === "adjust") {
      const pounds = Number(amount);
      if (typeof billingMonth !== "string" || !/^\d{4}-\d{2}-01$/.test(billingMonth)) {
        return jsonResponse({ error: "Pick which month's payment to change" }, 400);
      }
      if (!Number.isFinite(pounds) || Math.abs(pounds) < 0.01 || Math.abs(pounds) > 1000) {
        return jsonResponse({ error: "Enter the amount to take off (or add), between 1p and £1,000" }, 400);
      }
      const note = typeof reason === "string" ? reason.trim().slice(0, 200) : "";
      if (!note) return jsonResponse({ error: "Add a short reason — it shows on the family's invoice" }, 400);
      if (!nextChargeYm || !customerId) {
        return jsonResponse({ error: "This membership has no upcoming payment to adjust" }, 400);
      }
      const targetYm = billingMonth.slice(0, 7);
      if (targetYm < nextChargeYm) {
        return jsonResponse({ error: `The ${monthLabel(targetYm)} payment has already been taken — the next one is ${monthLabel(nextChargeYm)}` }, 400);
      }
      const targetMonth = Number(targetYm.slice(5, 7));
      if (membership.free_month != null && targetMonth === Number(membership.free_month)) {
        return jsonResponse({ error: `No payment is taken in ${MONTH_NAMES[targetMonth - 1]} — it's this family's free month` }, 400);
      }
      // A membership that is ending has one last payment; months after it
      // will never be invoiced, so an adjustment there would silently vanish.
      if (membership.status === "cancel_scheduled" && membership.final_payment_date) {
        const finalYm = yearMonth(new Date(membership.final_payment_date));
        if (targetYm > finalYm) {
          return jsonResponse({ error: `This membership ends after the ${monthLabel(finalYm)} payment, so that's the last one you can change` }, 400);
        }
      }
      const roundedPounds = Math.round(pounds * 100) / 100;
      if (roundedPounds < 0 && Math.abs(roundedPounds) > Number(membership.monthly_amount) + 0.005) {
        return jsonResponse({ error: `That's more than the £${Number(membership.monthly_amount).toFixed(2)} monthly payment — a month can be free, but not less than free` }, 400);
      }

      const { data: row, error: insErr } = await supabase
        .from("membership_adjustments")
        .insert({
          membership_id: membership.id,
          user_id: ownerId,
          billing_month: billingMonth,
          amount: roundedPounds,
          reason: note,
          status: "pending",
          stripe_env: env,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (insErr || !row) {
        if ((insErr as any)?.code === "23505") {
          return jsonResponse({ error: `There's already an adjustment on the ${monthLabel(targetYm)} payment — remove it first if you want a different amount` }, 400);
        }
        console.error("membership_adjustments insert failed:", insErr);
        return jsonResponse({ error: "Couldn't save the adjustment — please try again" }, 500);
      }

      // Next payment due: hand it to Stripe now. Later months wait for the
      // nightly job. Once Stripe has been asked, the row is never deleted —
      // a lost reply is reconciled by the job (it finds the item by the
      // adjustment id), so a retry can't create a second credit.
      let stripePending = false;
      if (targetYm === nextChargeYm) {
        let invoiceItem: any = null;
        try {
          invoiceItem = await ensureAdjustmentInvoiceItem(stripe, connectOpts, customerId, sub.id, row);
        } catch (e: any) {
          console.error("Stripe invoice item failed for adjustment", row.id, e);
          if (e?.type === "StripeInvalidRequestError") {
            // Stripe definitively refused — nothing was created, safe to undo.
            await supabase.from("membership_adjustments").delete().eq("id", row.id).eq("status", "pending");
            return jsonResponse({ error: `Stripe wouldn't accept the change: ${e?.message ?? "unknown error"}` }, 502);
          }
          stripePending = true; // ambiguous outcome — leave pending for the nightly reconcile
        }
        if (invoiceItem) {
          const marked = await markAdjustmentApplied(supabase, row.id, invoiceItem.id);
          if (marked) {
            row.status = "applied";
            row.stripe_invoice_item_id = invoiceItem.id;
            row.applied_at = new Date().toISOString();
          } else {
            stripePending = true; // the job will re-find the item and mark it
          }
        }
      }

      return jsonResponse({ success: true, adjustment: row, nextChargeMonth: nextChargeYm, stripePending });
    }

    if (action === "remove_adjustment") {
      if (!adjustmentId || typeof adjustmentId !== "string") {
        return jsonResponse({ error: "No adjustment selected" }, 400);
      }
      const { data: row } = await supabase
        .from("membership_adjustments")
        .select("*")
        .eq("id", adjustmentId)
        .eq("membership_id", membership.id)
        .maybeSingle();
      if (!row) return jsonResponse({ error: "Adjustment not found" }, 404);
      if (row.status === "removed") return jsonResponse({ success: true, adjustment: row });
      if (row.status === "applied" && row.stripe_invoice_item_id) {
        try {
          await stripe.invoiceItems.del(row.stripe_invoice_item_id, connectOpts);
        } catch (e: any) {
          console.error("Could not delete invoice item", row.stripe_invoice_item_id, e);
          return jsonResponse({
            error: "That month's invoice has already been raised in Stripe, so this can't be undone from here — refund the difference from the Stripe dashboard instead",
          }, 400);
        }
      }
      const nowIso = new Date().toISOString();
      await supabase
        .from("membership_adjustments")
        .update({ status: "removed", removed_at: nowIso })
        .eq("id", row.id);
      return jsonResponse({ success: true, adjustment: { ...row, status: "removed", removed_at: nowIso } });
    }

    // Fetched once — both remaining actions email a confirmation.
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", ownerId)
      .maybeSingle();

    // ────────────────────────────────────────────────────────────────────
    // CANCEL
    // ────────────────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (membership.status === "cancel_scheduled") {
        return jsonResponse({ error: "This membership is already scheduled to end" }, 400);
      }

      // One month's notice: the NEXT renewal still charges (final payment on
      // the usual billing day), the membership stays active for the month that
      // payment covers, and the subscription ends at the close of that month.
      const finalPaymentDate = new Date(sub.current_period_end * 1000);
      const endDate = addOneMonth(sub.current_period_end);

      // Count the family's active memberships on this subscription — if this is
      // the only one left, schedule the whole subscription to end; otherwise the
      // daily maintenance job removes just this item once its final month is up.
      const { data: siblings } = await supabase
        .from("memberships")
        .select("id")
        .eq("stripe_subscription_id", membership.stripe_subscription_id)
        .in("status", ["active", "past_due", "paused"]);
      const isLastActive = (siblings ?? []).filter((m: any) => m.id !== membership.id).length === 0;

      if (isLastActive) {
        await stripe.subscriptions.update(
          membership.stripe_subscription_id,
          { cancel_at: Math.floor(endDate.getTime() / 1000) },
          connectOpts,
        );
      }

      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("memberships")
        .update({
          status: "cancel_scheduled",
          cancel_requested_at: nowIso,
          final_payment_date: finalPaymentDate.toISOString(),
          cancel_at: endDate.toISOString(),
          updated_at: nowIso,
        })
        .eq("id", membership.id);
      if (updateError) throw updateError;

      // Confirmation email (best effort).
      try {
        const [{ data: student }, { data: cls }] = await Promise.all([
          membership.student_id
            ? supabase.from("students").select("first_name, last_name").eq("id", membership.student_id).maybeSingle()
            : Promise.resolve({ data: null }),
          membership.class_id
            ? supabase.from("classes").select("name").eq("id", membership.class_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (profile?.email) {
          await supabase.functions.invoke("send-email", {
            headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
            body: {
              template: "membership_cancel_requested",
              to: profile.email,
              data: {
                parentName: profile.full_name,
                studentName: student ? `${student.first_name} ${student.last_name}` : null,
                className: cls?.name ?? "your class",
                monthlyAmount: Number(membership.monthly_amount),
                finalPaymentDate: finalPaymentDate.toISOString(),
                endDate: endDate.toISOString(),
              },
            },
          });
        }
      } catch (e) {
        console.error("Cancel-confirmation email failed:", e);
      }

      return jsonResponse({
        success: true,
        finalPaymentDate: finalPaymentDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // SWITCH CLASS
    // ────────────────────────────────────────────────────────────────────
    if (!newClassId || typeof newClassId !== "string") {
      return jsonResponse({ error: "No new class selected" }, 400);
    }
    if (newClassId === membership.class_id) {
      return jsonResponse({ error: "The membership is already for that class" }, 400);
    }
    if (membership.status === "cancel_scheduled") {
      return jsonResponse({ error: "This membership is scheduled to end — contact us if you'd like to keep it going on a different class" }, 400);
    }
    if (membership.status === "past_due") {
      return jsonResponse({ error: "There's an outstanding payment on this membership — please update your card details first" }, 400);
    }
    if (!membership.stripe_subscription_item_id) {
      return jsonResponse({ error: "This membership isn't linked to a payment plan we can update — please email hello@thedanceexclusive.co.uk" }, 400);
    }

    const { data: newCls } = await supabase
      .from("classes")
      .select(CLASS_FIELDS)
      .eq("id", newClassId)
      .maybeSingle();
    if (!newCls) return jsonResponse({ error: "Class not found" }, 404);
    if (newCls.class_type !== "children") {
      return jsonResponse({ error: "Memberships can only move to another children's class" }, 400);
    }
    if (!newCls.is_active || newCls.status !== "confirmed" || !newCls.publicly_visible || !newCls.booking_enabled || newCls.invite_only) {
      return jsonResponse({ error: `${newCls.name} isn't open for bookings right now` }, 400);
    }

    // The same child can't hold two memberships for one class.
    let clashQuery = supabase
      .from("memberships")
      .select("id")
      .eq("user_id", ownerId)
      .eq("class_id", newClassId)
      .in("status", ["incomplete", "active", "past_due", "paused", "cancel_scheduled"]);
    clashQuery = membership.student_id
      ? clashQuery.eq("student_id", membership.student_id)
      : clashQuery.is("student_id", null);
    const { data: clash } = await clashQuery.limit(1).maybeSingle();
    if (clash) {
      return jsonResponse({ error: `There's already a membership for ${newCls.name}` }, 400);
    }

    // ── Re-price the whole family with the new class in place, using the
    //    exact same rules as checkout: per child, the most expensive class is
    //    full price, further classes get the additional-class rate, the total
    //    caps at the £110 Unlimited price, and the sibling discount applies
    //    across children. ──
    const { data: familyRows } = await supabase
      .from("memberships")
      .select("*")
      .eq("stripe_subscription_id", membership.stripe_subscription_id)
      .in("status", ["active", "past_due", "paused", "cancel_scheduled"]);
    const family = familyRows ?? [];

    const effectiveClassId = (m: any) => (m.id === membership.id ? newClassId : m.class_id);
    const classIds = [...new Set(family.map(effectiveClassId).filter(Boolean))];
    const { data: classRows } = await supabase
      .from("classes")
      .select(CLASS_FIELDS)
      .in("id", classIds);
    const classById = new Map((classRows ?? []).map((c: any) => [c.id, c]));

    const studentIds = [...new Set(family.map((m: any) => m.student_id).filter(Boolean))];
    const { data: studentRows } = studentIds.length > 0
      ? await supabase.from("students").select("id, first_name, last_name, is_self").in("id", studentIds)
      : { data: [] as any[] };
    const studentById = new Map((studentRows ?? []).map((s: any) => [s.id, s]));

    const monthlyInputs = family
      .map((m: any) => {
        const cls = classById.get(effectiveClassId(m));
        if (!cls) return null;
        return {
          id: m.id,
          classId: cls.id,
          studentId: m.student_id ?? null,
          fullMonthly: monthlyPrice(cls),
          additionalMonthly: additionalMonthlyPrice(cls),
        };
      })
      .filter(Boolean) as { id: string; classId: string; studentId: string | null; fullMonthly: number; additionalMonthly: number }[];
    const basePrices = priceMonthlyItems(monthlyInputs);

    // Children of this family with existing active bookings count as prior
    // siblings — the same rule create-payment-intent applies at checkout.
    const priorBookedChildIds: string[] = [];
    const { data: priorBookings } = await supabase
      .from("bookings")
      .select("student_id, students(is_self)")
      .eq("parent_id", ownerId)
      .eq("status", "confirmed")
      .not("student_id", "is", null);
    for (const b of priorBookings ?? []) {
      if (b.student_id && !(b as any).students?.is_self) priorBookedChildIds.push(b.student_id as string);
    }

    const siblingInputs = monthlyInputs.map((mi) => {
      const cls = classById.get(mi.classId);
      const student = mi.studentId ? studentById.get(mi.studentId) : null;
      return {
        id: mi.id,
        studentId: mi.studentId,
        isSelfStudent: Boolean(student?.is_self),
        classType: (cls?.class_type ?? "children") as "children" | "adult",
        siblingDiscountEnabled: cls?.sibling_discount_enabled ?? true,
        totalPrice: basePrices.get(mi.id) ?? 0,
      };
    });
    const sibling = computeSiblingDiscount(siblingInputs, priorBookedChildIds);

    const newAmounts = new Map<string, number>();
    for (const mi of monthlyInputs) {
      const base = basePrices.get(mi.id) ?? 0;
      newAmounts.set(mi.id, round2(base - (sibling.perItem.get(mi.id) ?? 0)));
    }
    const switchedAmount = newAmounts.get(membership.id);
    if (switchedAmount == null) {
      return jsonResponse({ error: "Could not price the new class — please email hello@thedanceexclusive.co.uk" }, 500);
    }

    // A studio credit already set against a coming payment must still fit
    // the new price, or the invoice would go negative and roll into the
    // following month. Ask for it to be removed (and re-added) first.
    const { data: liveCredits } = await supabase
      .from("membership_adjustments")
      .select("billing_month, amount")
      .eq("membership_id", membership.id)
      .in("status", ["pending", "applied"])
      .lt("amount", 0);
    const tooBig = (liveCredits ?? []).find((a: any) => Math.abs(Number(a.amount)) > switchedAmount + 0.005);
    if (tooBig) {
      return jsonResponse({
        error: `There's a £${Math.abs(Number(tooBig.amount)).toFixed(2)} credit on the ${monthLabel(String(tooBig.billing_month))} payment, which is more than the new class's £${switchedAmount.toFixed(2)} a month. Remove that credit first, then move the class and add it back.`,
      }, 400);
    }

    // ── Update Stripe: the switched item always gets a fresh price (new class
    //    name + amount); sibling items only when their amount changed. ──
    const nowIso = new Date().toISOString();
    for (const m of family) {
      const amount = newAmounts.get(m.id);
      if (amount == null) continue;
      const isSwitched = m.id === membership.id;
      const amountChanged = Math.abs(amount - Number(m.monthly_amount)) >= 0.005;
      if (!isSwitched && !amountChanged) continue;
      if (!m.stripe_subscription_item_id) {
        console.error("Membership has no subscription item, skipping reprice:", m.id);
        continue;
      }
      const cls = classById.get(effectiveClassId(m));
      const student = m.student_id ? studentById.get(m.student_id) : null;
      const price = await stripe.prices.create(
        {
          currency: "gbp",
          unit_amount: Math.round(amount * 100),
          recurring: { interval: "month" },
          product_data: {
            name: `${cls?.name || "Class"} — Monthly Membership${student ? ` (${student.first_name} ${student.last_name})` : ""}`,
          },
        },
        connectOpts,
      );
      await stripe.subscriptionItems.update(
        m.stripe_subscription_item_id,
        { price: price.id, proration_behavior: "none" },
        connectOpts,
      );
      await supabase
        .from("memberships")
        .update({
          ...(isSwitched ? { class_id: newClassId } : {}),
          monthly_amount: amount,
          stripe_price_id: price.id,
          updated_at: nowIso,
        })
        .eq("id", m.id);
    }

    // ── Move the standing booking so the register updates immediately. ──
    const { data: oldClsRow } = membership.class_id
      ? await supabase.from("classes").select("name").eq("id", membership.class_id).maybeSingle()
      : { data: null as any };
    const oldClassName = oldClsRow?.name ?? "previous class";

    const findMonthlyBooking = async (classId: string) => {
      let q = supabase
        .from("bookings")
        .select("id, notes")
        .eq("parent_id", ownerId)
        .eq("class_id", classId)
        .eq("status", "confirmed")
        .eq("booking_type", "monthly");
      q = membership.student_id ? q.eq("student_id", membership.student_id) : q.is("student_id", null);
      const { data } = await q.limit(1).maybeSingle();
      return data as { id: string; notes: string | null } | null;
    };
    const oldBooking = membership.class_id ? await findMonthlyBooking(membership.class_id) : null;
    const existingNewBooking = await findMonthlyBooking(newClassId);

    if (existingNewBooking) {
      // Already on the new register somehow — just retire the old entry.
      if (oldBooking) {
        await supabase
          .from("bookings")
          .update({ status: "cancelled", notes: `${oldBooking.notes ?? ""} | Cancelled by class switch on ${nowIso.slice(0, 10)}` })
          .eq("id", oldBooking.id);
      }
    } else if (oldBooking) {
      await supabase
        .from("bookings")
        .update({
          class_id: newClassId,
          amount: switchedAmount,
          notes: `${oldBooking.notes ?? ""} | Switched from ${oldClassName} on ${nowIso.slice(0, 10)}`,
        })
        .eq("id", oldBooking.id);
    } else {
      await supabase.from("bookings").insert({
        class_id: newClassId,
        camp_id: null,
        student_id: membership.student_id,
        parent_id: ownerId,
        status: "confirmed",
        booking_type: "monthly",
        amount: switchedAmount,
        notes: `Membership class switch (subscription ${membership.stripe_subscription_id})`,
      });
    }

    const nextPaymentDate = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    // Confirmation email (best effort).
    try {
      const student = membership.student_id ? studentById.get(membership.student_id) : null;
      if (profile?.email) {
        await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "membership_class_changed",
            to: profile.email,
            data: {
              parentName: profile.full_name,
              studentName: student ? `${student.first_name} ${student.last_name}` : null,
              oldClassName,
              newClassName: newCls.name,
              newDay: newCls.day_of_week,
              newStartTime: newCls.start_time,
              newEndTime: newCls.end_time,
              newVenueName: (newCls as any).venues?.name ?? null,
              monthlyAmount: switchedAmount,
              nextPaymentDate,
            },
          },
        });
      }
    } catch (e) {
      console.error("Class-change email failed:", e);
    }

    return jsonResponse({
      success: true,
      newMonthlyAmount: switchedAmount,
      newClassName: newCls.name,
      nextPaymentDate,
    });
  } catch (error: any) {
    console.error("manage-membership error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
