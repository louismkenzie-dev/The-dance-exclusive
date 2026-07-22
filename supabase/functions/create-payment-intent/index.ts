import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  bookingApplicationFee,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { validateAndCompute } from "../_shared/coupon.ts";
import {
  ADULT_PASSES,
  type AdultPassType,
  additionalMonthlyPrice,
  computeSiblingDiscount,
  monthlyPrice,
  priceMonthlyItems,
  round2,
  sessionPrice,
  termPrice,
  trialPrice,
  yearlyPrice,
} from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IncomingItem {
  itemKind?: "class" | "camp" | "pass";
  classId?: string | null;
  campId?: string | null;
  passType?: string | null;
  className?: string;
  classType?: "children" | "adult";
  studentId?: string | null;
  studentName?: string | null;
  pricingPlan: string;
  totalPrice: number;
  sessionsCount?: number | null;
  selectedSessionIds?: string[];
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, customerEmail, userId, environment, couponCode, previousPaymentIntentId } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: "No items provided" }, 400);
    }
    const cartItems = items as IncomingItem[];

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);
    // Direct charges on The Dance Exclusive's connected account (when configured).
    const connectOpts = connectRequestOptions(env);

    // Cancel any previous PaymentIntent the client is replacing — prevents
    // an abandoned PI from being confirmed later and creating a duplicate
    // charge for the same cart.
    if (previousPaymentIntentId && typeof previousPaymentIntentId === "string") {
      try {
        await stripe.paymentIntents.cancel(previousPaymentIntentId, {}, connectOpts);
        console.log("Cancelled previous PaymentIntent:", previousPaymentIntentId);
      } catch (e: any) {
        // Ignore — PI may already be confirmed, cancelled, or expired.
        console.log(
          "Could not cancel previous PaymentIntent",
          previousPaymentIntentId,
          "—",
          e?.message,
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const kindOf = (item: IncomingItem) => item.itemKind ?? "class";

    // ------------------------------------------------------------------
    // Attendee profiles: every booking must reference one (children AND
    // adults booking themselves). Enforced server-side so a tampered client
    // can never create attendee-less bookings.
    // ------------------------------------------------------------------
    const attendeeError = (message: string) =>
      jsonResponse({ error: message, code: "attendee_profile_required" }, 400);

    const studentIds = [...new Set(cartItems.map((i) => i.studentId).filter(Boolean))] as string[];
    if (cartItems.some((i) => !i.studentId)) {
      return attendeeError(
        "Every booking needs an attendee. Please choose who the class is for before paying.",
      );
    }
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, date_of_birth, parent_id, is_self")
      .in("id", studentIds);
    for (const item of cartItems) {
      const s = (students ?? []).find((st: any) => st.id === item.studentId);
      if (!s || (userId && s.parent_id !== userId)) {
        return attendeeError("Attendee profile not found for one of your bookings. Please re-add it to your basket.");
      }
      if (!s.date_of_birth) {
        return attendeeError(
          `${s.first_name} ${s.last_name}'s profile is incomplete — please add their date of birth in your account before booking.`,
        );
      }
    }

    // ------------------------------------------------------------------
    // Load the products being bought so every price is re-computed
    // server-side. The client's totals are validated, never trusted.
    // ------------------------------------------------------------------
    const classIds = [...new Set(cartItems.filter((i) => kindOf(i) === "class").map((i) => i.classId).filter(Boolean))] as string[];
    const campIds = [...new Set(cartItems.filter((i) => kindOf(i) === "camp").map((i) => i.campId).filter(Boolean))] as string[];

    const { data: classRows } = classIds.length > 0
      ? await supabaseAdmin
        .from("classes")
        .select("id, name, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, allow_trial, booking_enabled, sibling_discount_enabled")
        .in("id", classIds)
      : { data: [] as any[] };
    const { data: campRows } = campIds.length > 0
      ? await supabaseAdmin
        .from("camps")
        .select("id, name, class_type, price_per_day, price_total, is_active, sibling_discount_enabled")
        .in("id", campIds)
      : { data: [] as any[] };

    const classById = new Map((classRows ?? []).map((c: any) => [c.id, c]));
    const campById = new Map((campRows ?? []).map((c: any) => [c.id, c]));

    // Remaining scheduled sessions per class — needed to derive term prices.
    const today = new Date().toISOString().split("T")[0];
    const remainingByClass = new Map<string, number>();
    const termClassIds = [...new Set(
      cartItems
        .filter((i) => kindOf(i) === "class" && i.pricingPlan === "term")
        .map((i) => i.classId as string),
    )];
    for (const classId of termClassIds) {
      const { count } = await supabaseAdmin
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "scheduled")
        .gte("session_date", today);
      remainingByClass.set(classId, count ?? 0);
    }

    // Monthly items are priced together (additional-class rates + £110 cap).
    const itemKey = (item: IncomingItem, index: number) => `${index}`;
    const monthlyInputs = cartItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => kindOf(item) === "class" && item.pricingPlan === "monthly")
      .map(({ item, index }) => {
        const cls = classById.get(item.classId as string);
        return cls
          ? {
            id: itemKey(item, index),
            studentId: item.studentId ?? null,
            fullMonthly: monthlyPrice(cls),
            additionalMonthly: additionalMonthlyPrice(cls),
          }
          : null;
      })
      .filter(Boolean) as { id: string; studentId: string | null; fullMonthly: number; additionalMonthly: number }[];
    const monthlyPrices = priceMonthlyItems(monthlyInputs);

    const expectedPrices: number[] = [];
    for (const [index, item] of cartItems.entries()) {
      const kind = kindOf(item);

      if (kind === "pass") {
        const pass = ADULT_PASSES[item.passType as AdultPassType];
        if (!pass) return jsonResponse({ error: "Unknown class pass in your basket. Please remove it and re-add." }, 400);
        expectedPrices.push(pass.price);
        continue;
      }

      if (kind === "camp") {
        const camp = campById.get(item.campId as string);
        if (!camp || !camp.is_active) {
          return jsonResponse({ error: `${item.className || "A holiday workshop"} is no longer available. Please remove it from your basket.` }, 400);
        }
        // Holiday workshops are priced per drop-in day only.
        const dayCount = Math.max(1, Number(item.sessionsCount || item.selectedSessionIds?.length || 1));
        const perDay = camp.price_per_day != null ? Number(camp.price_per_day) : null;
        const expected = perDay != null && perDay > 0
          ? round2(perDay * dayCount)
          : Number(camp.price_total || 0);
        expectedPrices.push(expected);
        continue;
      }

      const cls = classById.get(item.classId as string);
      if (!cls) {
        return jsonResponse({ error: `${item.className || "A class"} is no longer available. Please remove it from your basket.` }, 400);
      }

      const plan = item.pricingPlan;
      // Plan availability rules: children have no drop-ins; adults pay as
      // they go (or use passes) rather than memberships.
      if (cls.class_type === "children" && plan === "session") {
        return jsonResponse({
          error: `${cls.name} is a children's class — drop-in sessions aren't available for children. Choose a trial, monthly membership, termly or yearly plan instead.`,
          code: "plan_not_allowed",
        }, 400);
      }
      if (cls.class_type === "adult" && (plan === "monthly" || plan === "term" || plan === "yearly")) {
        return jsonResponse({
          error: `${cls.name} is an adult class — adults book pay-as-you-go classes or multi-class passes.`,
          code: "plan_not_allowed",
        }, 400);
      }

      let expected: number | null = null;
      if (plan === "trial") {
        if (!cls.allow_trial) {
          return jsonResponse({ error: `${cls.name} doesn't offer trial sessions.`, code: "plan_not_allowed" }, 400);
        }
        expected = trialPrice(cls);
      } else if (plan === "session") {
        const count = Math.max(1, Number(item.sessionsCount || item.selectedSessionIds?.length || 1));
        expected = round2(sessionPrice(cls) * count);
      } else if (plan === "monthly") {
        expected = monthlyPrices.get(itemKey(item, index)) ?? monthlyPrice(cls);
      } else if (plan === "term") {
        expected = termPrice(cls, remainingByClass.get(cls.id) ?? 0);
        if (expected == null) {
          return jsonResponse({ error: `${cls.name} has no remaining sessions this term, so the termly plan isn't available.`, code: "plan_not_allowed" }, 400);
        }
      } else if (plan === "yearly") {
        expected = yearlyPrice(cls);
      } else {
        return jsonResponse({ error: `Unknown pricing plan "${plan}" in your basket.` }, 400);
      }
      expectedPrices.push(expected);
    }

    // Validate the client's prices against the server's own computation.
    for (const [index, item] of cartItems.entries()) {
      const expected = expectedPrices[index];
      const sent = round2(Number(item.totalPrice || 0));
      if (Math.abs(expected - sent) > 0.01) {
        console.error("Price mismatch", { index, className: item.className, expected, sent });
        return jsonResponse({
          error: `The price of ${item.className || "an item"} has changed (now £${expected.toFixed(2)}). Please remove it from your basket and re-add it.`,
          code: "price_mismatch",
        }, 409);
      }
    }

    // ------------------------------------------------------------------
    // Duplicate-booking pre-check: refuse to charge for items the parent
    // already has an active booking for.
    // ------------------------------------------------------------------
    if (userId) {
      for (const item of cartItems) {
        const kind = kindOf(item);
        if (kind === "pass") continue;
        const q = supabaseAdmin
          .from("bookings")
          .select("id")
          .eq("parent_id", userId)
          .in("status", ["confirmed", "pending_payment"]);
        if (kind === "camp") q.eq("camp_id", item.campId);
        else q.eq("class_id", item.classId);
        if (item.studentId) q.eq("student_id", item.studentId);
        else q.is("student_id", null);
        const { data: existing } = await q.maybeSingle();
        if (existing) {
          return jsonResponse({
            error: `${item.studentName || "This person"} is already booked into ${item.className || "this class"}. Remove it from your cart to continue.`,
            code: "duplicate_booking",
          }, 409);
        }
      }
    }

    // ------------------------------------------------------------------
    // Automatic 10% sibling discount — second child onwards, children's
    // classes and holiday workshops only, never adults.
    // ------------------------------------------------------------------
    const studentById = new Map((students ?? []).map((s: any) => [s.id, s]));
    const siblingInputs = cartItems.map((item, index) => {
      const kind = kindOf(item);
      const student = studentById.get(item.studentId as string);
      const product = kind === "camp" ? campById.get(item.campId as string) : classById.get(item.classId as string);
      return {
        id: itemKey(item, index),
        studentId: item.studentId ?? null,
        isSelfStudent: Boolean(student?.is_self),
        classType: ((kind === "pass" ? "adult" : product?.class_type) ?? "adult") as "children" | "adult",
        siblingDiscountEnabled: product?.sibling_discount_enabled ?? true,
        totalPrice: expectedPrices[index],
      };
    });

    // Children of this family with existing active bookings count as prior
    // siblings — a second child's first booking is discounted immediately.
    const priorBookedChildIds: string[] = [];
    if (userId) {
      const { data: priorBookings } = await supabaseAdmin
        .from("bookings")
        .select("student_id, students(is_self)")
        .eq("parent_id", userId)
        .eq("status", "confirmed")
        .not("student_id", "is", null);
      for (const b of priorBookings ?? []) {
        if (b.student_id && !(b as any).students?.is_self) priorBookedChildIds.push(b.student_id as string);
      }
    }

    const sibling = computeSiblingDiscount(siblingInputs, priorBookedChildIds);
    const siblingDiscountInPence = Math.round(sibling.total * 100);

    // Per-item charged amounts (after sibling discount) — used in metadata so
    // the webhook records what was actually paid per booking.
    const chargedPrices = cartItems.map((item, index) => {
      const discount = sibling.perItem.get(itemKey(item, index)) ?? 0;
      return round2(expectedPrices[index] - discount);
    });

    // Compute subtotal from the server-side prices.
    let subtotalInPence = 0;
    for (const charged of chargedPrices) {
      const amountInPence = Math.round(charged * 100);
      if (amountInPence < 0) throw new Error("Invalid negative amount");
      subtotalInPence += amountInPence;
    }

    // Apply coupon (server-side re-validation; holiday workshops only).
    let couponId: string | null = null;
    let couponCodeApplied: string | null = null;
    let discountInPence = 0;

    if (couponCode && typeof couponCode === "string" && couponCode.trim().length > 0) {
      const couponItems = cartItems.map((item, index) => ({
        classId: item.classId ?? "",
        classType: item.classType,
        pricingPlan: item.pricingPlan,
        totalPrice: chargedPrices[index],
        itemKind: kindOf(item),
        campId: item.campId ?? null,
      }));
      const result = await validateAndCompute(supabaseAdmin, couponCode, userId, couponItems);
      if ("error" in result) {
        return jsonResponse({ error: result.error }, 400);
      }
      couponId = result.couponId;
      couponCodeApplied = result.code;
      discountInPence = Math.round(result.discountAmount * 100);
    }

    const totalAmountInPence = Math.max(0, subtotalInPence - discountInPence);
    if (totalAmountInPence < 30) {
      throw new Error("Total amount is below the £0.30 minimum charge");
    }

    // Compact metadata so we stay under Stripe's 500-char per-value limit.
    const bookingMetadata = Object.fromEntries(
      cartItems.map((item, index) => [
        `item_${index}`,
        JSON.stringify({
          k: kindOf(item),
          c: item.classId || "",
          m: item.campId || "",
          pt: item.passType || "",
          s: item.studentId || "",
          p: item.pricingPlan,
          t: chargedPrices[index],
        }),
      ]),
    );

    const description = cartItems.length === 1
      ? `${cartItems[0].className}${cartItems[0].studentName ? ` — ${cartItems[0].studentName}` : ""}`
      : `${cartItems.length} bookings`;

    // Nullshift platform fee (1% of booking revenue) — only when Connect is
    // configured; charged on top of Stripe's own processing fees.
    const applicationFee = bookingApplicationFee(env, totalAmountInPence);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountInPence,
        currency: "gbp",
        // Cards only (Apple Pay / Google Pay ride on "card") — Klarna and
        // other BNPL/redirect methods are deliberately excluded.
        payment_method_types: ["card"],
        description,
        ...(applicationFee != null && { application_fee_amount: applicationFee }),
        ...(customerEmail && { receipt_email: customerEmail }),
        metadata: {
          userId: userId || "",
          itemCount: String(cartItems.length),
          checkoutType: "class_booking",
          ...(siblingDiscountInPence > 0 && {
            siblingDiscount: String(siblingDiscountInPence / 100),
          }),
          ...(couponId && {
            couponId,
            couponCode: couponCodeApplied || "",
            discountAmount: String(discountInPence / 100),
          }),
          ...bookingMetadata,
        },
      },
      connectOpts,
    );

    return jsonResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalAmountInPence,
      siblingDiscountAmount: siblingDiscountInPence / 100,
      discountAmount: discountInPence / 100,
    });
  } catch (error: any) {
    console.error("PaymentIntent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
