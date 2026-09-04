// Shared post-payment fulfilment for a succeeded PaymentIntent: creates
// class/camp bookings, creates adult class passes, records coupon
// redemptions, and sends the confirmation email. Used by both
// payments-webhook (event-driven) and get-payment-intent-status (fallback
// polling) — both paths are idempotent.
import { loadPasses } from "./pricing.ts";

export interface FulfilmentItem {
  kind: "class" | "camp" | "pass";
  classId: string | null;
  campId: string | null;
  passType: string | null;
  studentId: string | null;
  pricingPlan: string;
  totalPrice: number;
  /** metadata key, e.g. "item_0" — used for pass idempotency */
  ref: string;
  /** Chosen session date (trials) — recorded in the booking notes so the
   *  register shows the booking only on that day and reminders know when. */
  sessionDate: string | null;
  /** Chosen session dates (pay-as-you-go) — fulfilled as one dated booking
   *  per session so registers and the 24h self-service move know exactly
   *  which days were paid for. */
  sessionDates: string[] | null;
}

/** Parse the compact per-item PI metadata written by create-payment-intent.
 *  Handles both the current format ({k,c,m,pt,s,p,t}) and the legacy one
 *  ({c,s,p,t}) from PaymentIntents created before this release. */
export function parsePaymentIntentItems(metadata: Record<string, unknown> | null | undefined): FulfilmentItem[] {
  const compact = Object.entries(metadata || {})
    .filter(([key]) => key.startsWith("item_"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const items: FulfilmentItem[] = [];
  for (const [key, value] of compact) {
    let parsed: any;
    try {
      parsed = JSON.parse(String(value));
    } catch {
      console.error("Failed to parse item metadata:", key);
      continue;
    }
    if (!parsed) continue;
    const kind = parsed.k === "camp" || parsed.k === "pass" ? parsed.k : "class";
    if (kind === "class" && !parsed.c) continue;
    if (kind === "camp" && !parsed.m) continue;
    if (kind === "pass" && !parsed.pt) continue;
    items.push({
      kind,
      classId: parsed.c || null,
      campId: parsed.m || null,
      passType: parsed.pt || null,
      studentId: parsed.s || null,
      pricingPlan: parsed.p || "session",
      totalPrice: Number(parsed.t || 0),
      ref: key,
      sessionDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.d || "") ? parsed.d : null,
      sessionDates: Array.isArray(parsed.sd)
        ? parsed.sd.filter((d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
        : null,
    });
  }
  return items;
}

/** Create bookings/passes for every item of a succeeded PaymentIntent.
 *  Idempotent per item: bookings are guarded by an active-booking check,
 *  passes by the unique (payment_intent_id, cart_item_ref) index. */
export async function fulfillItems(
  supabase: any,
  userId: string,
  pi: { id: string },
  items: FulfilmentItem[],
): Promise<number> {
  let totalAmount = 0;
  // Only paid for if the basket holds a pass — keeps the common path untouched.
  const passCatalog = items.some((i) => i.kind === "pass") ? await loadPasses(supabase) : {};

  for (const item of items) {
    if (item.kind === "pass") {
      const pass = passCatalog[item.passType as string];
      if (!pass) {
        console.error("Unknown pass type in metadata:", item.passType);
        continue;
      }
      const windowDays = pass.windowDays ?? 28; // week_2: buy-ahead window; same-week rule enforced at redemption
      const expiresAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("class_passes").upsert(
        {
          user_id: userId,
          student_id: item.studentId,
          pass_type: item.passType,
          sessions_total: pass.sessions,
          sessions_remaining: pass.sessions,
          amount_paid: item.totalPrice,
          expires_at: expiresAt,
          payment_intent_id: pi.id,
          cart_item_ref: item.ref,
        },
        { onConflict: "payment_intent_id,cart_item_ref", ignoreDuplicates: true },
      );
      if (error) console.error("Failed to create class pass:", error);
      else {
        totalAmount += item.totalPrice;
        console.log("Class pass created:", item.passType);
      }
      continue;
    }

    // Pay-as-you-go with chosen dates: one dated booking per session, so the
    // register shows the dancer only on the days they paid for and each date
    // can be moved independently (24h self-service rule).
    if (item.kind === "class" && item.sessionDates && item.sessionDates.length > 0) {
      const n = item.sessionDates.length;
      const totalPence = Math.round(item.totalPrice * 100);
      const perPence = Math.floor(totalPence / n);
      for (let i = 0; i < n; i++) {
        const date = item.sessionDates[i];
        // Last date absorbs the rounding remainder so the sum matches exactly.
        const amount = (i === n - 1 ? totalPence - perPence * (n - 1) : perPence) / 100;
        // Duplicate guard: same attendee, same class, same date (idempotent
        // across webhook + polling double-fires and repeat purchases).
        const dupQuery = supabase
          .from("bookings")
          .select("id")
          .eq("parent_id", userId)
          .eq("class_id", item.classId)
          .in("status", ["confirmed", "pending_payment"])
          .ilike("notes", `%session ${date}%`)
          .limit(1);
        if (item.studentId) dupQuery.eq("student_id", item.studentId);
        else dupQuery.is("student_id", null);
        const { data: existingDated } = await dupQuery;
        if ((existingDated ?? []).length > 0) {
          console.log("Skipping duplicate dated booking:", item.classId, date);
          continue;
        }
        const { error } = await supabase.from("bookings").insert({
          class_id: item.classId,
          camp_id: null,
          student_id: item.studentId,
          parent_id: userId,
          status: "confirmed",
          booking_type: item.pricingPlan || "session",
          amount,
          notes: `Stripe PaymentIntent: ${pi.id} | session ${date}`,
        });
        if (error) console.error("Failed to create dated booking:", error);
        else {
          totalAmount += amount;
          console.log("Dated booking created:", item.classId, date);
        }
      }
      continue;
    }

    // class / camp booking with duplicate guard
    const dupQuery = supabase
      .from("bookings")
      .select("id")
      .eq("parent_id", userId)
      .in("status", ["confirmed", "pending_payment"]);
    if (item.kind === "camp") dupQuery.eq("camp_id", item.campId);
    else dupQuery.eq("class_id", item.classId);
    if (item.studentId) dupQuery.eq("student_id", item.studentId);
    else dupQuery.is("student_id", null);
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      console.log("Skipping duplicate booking:", item.kind, item.classId || item.campId, "student:", item.studentId);
      continue;
    }

    const { error } = await supabase.from("bookings").insert({
      class_id: item.kind === "camp" ? null : item.classId,
      camp_id: item.kind === "camp" ? item.campId : null,
      student_id: item.studentId,
      parent_id: userId,
      status: "confirmed",
      booking_type: item.kind === "camp" ? "camp" : (item.pricingPlan || "session"),
      amount: item.totalPrice,
      notes: `Stripe PaymentIntent: ${pi.id}${item.sessionDate ? ` | session ${item.sessionDate}` : ""}`,
    });
    if (error) console.error("Failed to create booking:", error);
    else {
      totalAmount += item.totalPrice;
      console.log("Booking created:", item.kind, item.classId || item.campId);
      // Trials are hot leads — let the studio know straight away.
      if (item.kind === "class" && item.pricingPlan === "trial") {
        try {
          await notifyAdminTrialBooked(supabase, userId, item);
        } catch (e) {
          console.error("Trial admin notification failed:", e);
        }
      }
    }
  }

  return totalAmount;
}

/** Email the studio inbox whenever a trial is booked. */
async function notifyAdminTrialBooked(supabase: any, userId: string, item: FulfilmentItem) {
  const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "hello@thedanceexclusive.co.uk";
  const [{ data: cls }, { data: student }, { data: parent }] = await Promise.all([
    item.classId
      ? supabase.from("classes").select("name, day_of_week, start_time, end_time, venues:venue_id ( name )").eq("id", item.classId).maybeSingle()
      : Promise.resolve({ data: null }),
    item.studentId
      ? supabase.from("students").select("first_name, last_name").eq("id", item.studentId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name, email, phone").eq("user_id", userId).maybeSingle(),
  ]);
  await supabase.functions.invoke("send-email", {
    headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
    body: {
      template: "admin_trial_booked",
      to: adminEmail,
      data: {
        className: cls?.name ?? "a class",
        dayOfWeek: cls?.day_of_week ?? null,
        startTime: cls?.start_time ?? null,
        endTime: cls?.end_time ?? null,
        venueName: cls?.venues?.name ?? null,
        sessionDate: item.sessionDate,
        studentName: student ? `${student.first_name} ${student.last_name}` : null,
        parentName: parent?.full_name ?? null,
        parentEmail: parent?.email ?? null,
        parentPhone: parent?.phone ?? null,
        amount: item.totalPrice,
      },
    },
  });
}

/**
 * Fulfil a PaymentIntent that belongs to a Stripe INVOICE (subscription
 * checkout or renewal) rather than a one-off basket charge. The cart payload
 * lives in the subscription's metadata (written by create-payment-intent).
 * Idempotent: bookings are per-item guarded, membership updates are
 * repeat-safe, coupon redemptions are keyed on the PI id.
 * Returns true when it handled the PI (caller should stop processing).
 */
export async function fulfillInvoicePaymentIntent(
  supabase: any,
  stripe: any,
  connectOpts: Record<string, unknown>,
  pi: any,
): Promise<boolean> {
  const invoiceId = typeof pi.invoice === "string" ? pi.invoice : pi.invoice?.id;
  if (!invoiceId) return false;

  const invoice = await stripe.invoices.retrieve(
    invoiceId,
    { expand: ["subscription"] },
    connectOpts,
  );
  const sub = invoice.subscription;
  if (!sub || typeof sub === "string") {
    console.warn("Invoice PI without an expanded subscription:", invoiceId);
    return true;
  }
  const userId = sub.metadata?.userId;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  if (invoice.billing_reason === "subscription_create") {
    if (!userId) {
      console.error("Subscription has no userId metadata:", sub.id);
      return true;
    }
    await activateMembershipCheckout(supabase, sub, {
      id: pi.id,
      amountReceived: pi.amount_received ?? null,
      metadata: sub.metadata,
    });
    return true;
  }

  // Renewal: roll the covered period forward and clear any past-due flag.
  const { error } = await supabase
    .from("memberships")
    .update({ current_period_end: periodEnd, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id);
  if (error) console.error("Failed to roll membership period:", error);
  await supabase
    .from("memberships")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("status", "past_due");
  return true;
}

/**
 * Shared membership-checkout activation: creates the basket's bookings from
 * the subscription's metadata, records the coupon, flips 'incomplete'
 * membership rows to 'active' and sends the confirmation email.
 *
 * `payment` is the first-invoice PaymentIntent for paid signups, or null for
 * August card-setup signups (nothing charged today — bookings reference the
 * subscription id instead).
 */
export async function activateMembershipCheckout(
  supabase: any,
  sub: any,
  payment: { id: string; amountReceived: number | null; metadata?: any } | null,
): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("Subscription has no userId metadata:", sub.id);
    return;
  }
  const reference = payment?.id ?? sub.id;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const items = parsePaymentIntentItems(sub.metadata);
  const totalAmount = await fulfillItems(supabase, userId, { id: reference }, items);
  if (payment) {
    await recordCouponRedemption(supabase, userId, { id: payment.id, metadata: payment.metadata ?? sub.metadata });
  }

  const { error } = await supabase
    .from("memberships")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("status", "incomplete");
  if (error) console.error("Failed to activate memberships:", error);

  const charged = payment
    ? (payment.amountReceived != null ? payment.amountReceived / 100 : totalAmount)
    : 0;
  await sendBookingConfirmationEmail(supabase, userId, reference, charged || null);
}

/**
 * August card-setup activation (no money moved today). Idempotent: only acts
 * when the subscription still has 'incomplete' membership rows — safe to call
 * from the client finalize step AND the daily maintenance fallback.
 * Returns true when activation ran.
 */
export async function activateMembershipSetup(supabase: any, sub: any): Promise<boolean> {
  const { data: incompleteRows } = await supabase
    .from("memberships")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .eq("status", "incomplete")
    .limit(1);
  if ((incompleteRows ?? []).length === 0) return false;
  await activateMembershipCheckout(supabase, sub, null);
  return true;
}

/** Record a coupon redemption once per PaymentIntent. */
export async function recordCouponRedemption(supabase: any, userId: string, pi: any) {
  const couponId = pi.metadata?.couponId;
  if (!couponId) return;
  const discountAmount = Number(pi.metadata?.discountAmount || 0);
  const { data: existingRedemption } = await supabase
    .from("coupon_redemptions")
    .select("id")
    .eq("payment_intent_id", pi.id)
    .limit(1);
  if (existingRedemption && existingRedemption.length > 0) return;
  const { error } = await supabase.from("coupon_redemptions").insert({
    coupon_id: couponId,
    user_id: userId,
    payment_intent_id: pi.id,
    amount_discounted: discountAmount,
  });
  if (error) console.error("Failed to record coupon redemption:", error);
}

/** Branded confirmation email covering class, camp and pass purchases. */
export async function sendBookingConfirmationEmail(
  supabase: any,
  userId: string,
  reference: string,
  totalAmount: number | null,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.email) {
    console.warn("No profile email found, skipping confirmation email:", userId);
    return;
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, booking_type, amount, notes,
       classes:class_id ( name, start_time, end_time, day_of_week,
                          venues:venue_id ( name, city ) ),
       camps:camp_id ( name, start_date, end_date,
                       venues:venue_id ( name, city ) ),
       students:student_id ( first_name, last_name )`,
    )
    .ilike("notes", `%${reference}%`);

  const { data: passes } = await supabase
    .from("class_passes")
    .select("pass_type, sessions_total, amount_paid, expires_at")
    .eq("payment_intent_id", reference);

  if ((!bookings || bookings.length === 0) && (!passes || passes.length === 0)) {
    console.warn("No bookings found for reference, skipping email:", reference);
    return;
  }

  // Pass names for the receipt — only looked up when a pass was bought.
  const passCatalog = (passes ?? []).length > 0 ? await loadPasses(supabase) : {};

  // A code used on this payment is shown on the receipt so the per-booking
  // amounts and the total add up in the parent's eyes.
  const { data: redemption } = await supabase
    .from("coupon_redemptions")
    .select("amount_discounted, coupons:coupon_id ( code )")
    .eq("payment_intent_id", reference)
    .maybeSingle();
  const discountAmount = Number(redemption?.amount_discounted || 0);
  const discountCode = (redemption as any)?.coupons?.code ?? null;

  const emailPayload = {
    template: "booking_confirmation",
    to: profile.email,
    data: {
      parentName: profile.full_name,
      email: profile.email,
      totalAmount,
      reference,
      ...(discountAmount > 0 && { discountAmount, discountCode }),
      bookings: [
        ...(bookings ?? []).map((b: any) => ({
          id: b.id, // enables the per-booking entrance QR CTA in the email
          className: b.classes?.name || b.camps?.name || "Class",
          studentName: b.students
            ? `${b.students.first_name} ${b.students.last_name}`
            : null,
          dayOfWeek: b.classes?.day_of_week || null,
          startTime: b.classes?.start_time || null,
          endTime: b.classes?.end_time || null,
          venueName: b.classes?.venues?.name || b.camps?.venues?.name || null,
          venueCity: b.classes?.venues?.city || b.camps?.venues?.city || null,
          bookingType: b.booking_type,
          amount: b.amount,
        })),
        ...(passes ?? []).map((p: any) => ({
          id: null, // passes are not bookings — no entrance QR
          className: passCatalog[p.pass_type as string]?.label || "Class Pass",
          studentName: null,
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          venueName: null,
          venueCity: null,
          bookingType: "pass",
          amount: p.amount_paid,
        })),
      ],
    },
  };

  const { error } = await supabase.functions.invoke("send-email", {
    body: emailPayload,
    headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
  });
  if (error) {
    console.error("Failed to send confirmation email:", error);
  } else {
    console.log("Confirmation email sent to:", profile.email);
  }
}
