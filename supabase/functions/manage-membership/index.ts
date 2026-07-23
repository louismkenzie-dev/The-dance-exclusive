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

    const { action, membershipId, newClassId, environment } = await req.json();
    if (action !== "cancel" && action !== "switch_class") {
      return jsonResponse({ error: "Unknown action" }, 400);
    }
    if (!membershipId || typeof membershipId !== "string") {
      return jsonResponse({ error: "No membership selected" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", membershipId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return jsonResponse({ error: "Membership not found" }, 404);
    if (membership.status === "cancelled") {
      return jsonResponse({ error: "This membership has already ended" }, 400);
    }
    if (membership.status === "incomplete") {
      return jsonResponse({ error: "This membership hasn't started yet" }, 400);
    }

    const env = (environment || "sandbox") as StripeEnv;
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

    // Fetched once — both actions email a confirmation.
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", user.id)
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
      .eq("user_id", user.id)
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
      .eq("parent_id", user.id)
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
        .eq("parent_id", user.id)
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
        parent_id: user.id,
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
