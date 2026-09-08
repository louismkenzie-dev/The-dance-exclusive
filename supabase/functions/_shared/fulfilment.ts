// Shared post-payment fulfilment for a succeeded PaymentIntent: creates
// class/camp bookings, creates adult class passes, records coupon
// redemptions, and sends the confirmation email. Used by both
// payments-webhook (event-driven) and get-payment-intent-status (fallback
// polling) — both paths are idempotent.
import { loadPasses } from "./pricing.ts";
import { freeMonthFor } from "./billing.ts";

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
    // A past trial or paid-for date must not swallow the standing place the
    // family has just paid for — the same rule as the checkout pre-check.
    if (item.kind === "class" && item.pricingPlan !== "trial") {
      dupQuery.not("booking_type", "in", "(trial,session,drop_in)");
    }
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
  opts: { quiet?: boolean; env?: string } = {},
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

  // The rows this subscription activates must point at it. A checkout retry
  // replaces the family's placeholder rows, so the subscription that was
  // actually paid can find none — repair before activating.
  await ensureMembershipRows(supabase, sub, opts.env ?? (sub.livemode === false ? "sandbox" : "live"));

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

  if (opts.quiet) return;
  const charged = payment
    ? (payment.amountReceived != null ? payment.amountReceived / 100 : totalAmount)
    : 0;
  await sendBookingConfirmationEmail(supabase, userId, reference, charged || null);
}

/**
 * Every monthly membership on a Stripe subscription has a row pointing at
 * it. A checkout retry deletes the previous attempt's placeholder rows and
 * writes new ones for the new subscription — so if the family then pays (or
 * saves a card against) the EARLIER subscription, it has no rows, and the
 * family's rows point at an attempt that will never start. This re-points
 * such rows to the live subscription, or creates them from its metadata.
 * Rows are (re)written as 'incomplete' so the normal activation applies.
 * Returns the number of rows repaired.
 */
export async function ensureMembershipRows(supabase: any, sub: any, env: string): Promise<number> {
  const userId = sub.metadata?.userId;
  if (!userId) return 0;
  const monthly = parsePaymentIntentItems(sub.metadata).filter(
    (i) => i.kind === "class" && i.pricingPlan === "monthly" && i.classId,
  );
  if (monthly.length === 0) return 0;

  const { data: existing } = await supabase
    .from("memberships")
    .select("id, class_id, student_id")
    .eq("stripe_subscription_id", sub.id);
  const have = new Set((existing ?? []).map((r: any) => `${r.class_id}|${r.student_id ?? ""}`));
  const missing = monthly.filter((i) => !have.has(`${i.classId}|${i.studentId ?? ""}`));
  if (missing.length === 0) return 0;

  // A row can only point at a class and dancer that still exist — a deleted
  // one is skipped (and logged) rather than failing the whole repair.
  const classIds = [...new Set(missing.map((i) => i.classId as string))];
  const studentIds = [...new Set(missing.map((i) => i.studentId).filter((s): s is string => !!s))];
  const [{ data: knownClasses }, { data: knownStudents }] = await Promise.all([
    supabase.from("classes").select("id").in("id", classIds),
    studentIds.length > 0
      ? supabase.from("students").select("id").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const classExists = new Set((knownClasses ?? []).map((c: any) => c.id));
  const studentExists = new Set((knownStudents ?? []).map((s: any) => s.id));

  const subItems: any[] = sub.items?.data ?? [];
  const usedItems = new Set<string>();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const createdAt = sub.created ? new Date(sub.created * 1000) : new Date();
  const nowIso = new Date().toISOString();
  let repaired = 0;

  for (let n = 0; n < monthly.length; n++) {
    const item = monthly[n];
    const key = `${item.classId}|${item.studentId ?? ""}`;
    if (have.has(key)) {
      const pence = Math.round(item.totalPrice * 100);
      const taken = subItems.find((x) => !usedItems.has(x.id) && x.price?.unit_amount === pence) ?? subItems[n];
      if (taken) usedItems.add(taken.id);
      continue;
    }
    // Which subscription item is this membership? Each membership gets its
    // own recurring price at its exact amount, so match by amount first and
    // fall back to position (the items were created in basket order).
    const pence = Math.round(item.totalPrice * 100);
    const si = subItems.find((x) => !usedItems.has(x.id) && x.price?.unit_amount === pence)
      ?? subItems.find((x) => !usedItems.has(x.id));
    if (si) usedItems.add(si.id);

    if (!classExists.has(item.classId) || (item.studentId && !studentExists.has(item.studentId))) {
      console.warn(
        "Skipping membership row for subscription", sub.id,
        "— class or dancer no longer exists (class", item.classId, "dancer", item.studentId ?? "none", ")",
      );
      continue;
    }

    const fields = {
      stripe_subscription_id: sub.id,
      stripe_subscription_item_id: si?.id ?? null,
      stripe_price_id: si?.price?.id ?? null,
      monthly_amount: si?.price?.unit_amount != null ? si.price.unit_amount / 100 : item.totalPrice,
      status: "incomplete",
      stripe_env: env,
      current_period_end: periodEnd,
      stripe_setup_intent_id: null,
      updated_at: nowIso,
    };

    // Prefer the family's own placeholder for this class and dancer (left
    // behind by the attempt that never started) over creating a second row.
    let staleQuery = supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("class_id", item.classId)
      .eq("status", "incomplete")
      .neq("stripe_subscription_id", sub.id)
      .limit(1);
    staleQuery = item.studentId ? staleQuery.eq("student_id", item.studentId) : staleQuery.is("student_id", null);
    const { data: stale } = await staleQuery;

    if (stale?.[0]?.id) {
      const { error } = await supabase.from("memberships").update(fields).eq("id", stale[0].id);
      if (error) { console.error("Could not re-point membership row", stale[0].id, error); continue; }
      console.log("Re-pointed membership row", stale[0].id, "to subscription", sub.id);
    } else {
      const { error } = await supabase.from("memberships").insert({
        user_id: userId,
        student_id: item.studentId ?? null,
        class_id: item.classId,
        free_month: freeMonthFor(createdAt),
        ...fields,
      });
      if (error) { console.error("Could not create membership row for", sub.id, item.classId, error); continue; }
      console.log("Created missing membership row for subscription", sub.id, "class", item.classId);
    }
    have.add(key);
    repaired++;
  }
  return repaired;
}

/**
 * August card-setup activation (no money moved today). Idempotent: only acts
 * when the subscription still has 'incomplete' membership rows — safe to call
 * from the client finalize step AND the daily maintenance fallback.
 * Returns true when activation ran.
 */
export async function activateMembershipSetup(
  supabase: any,
  sub: any,
  opts: { quiet?: boolean; env?: string } = {},
): Promise<boolean> {
  await ensureMembershipRows(supabase, sub, opts.env ?? (sub.livemode === false ? "sandbox" : "live"));
  const { data: incompleteRows } = await supabase
    .from("memberships")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .eq("status", "incomplete")
    .limit(1);
  if ((incompleteRows ?? []).length === 0) return false;
  await activateMembershipCheckout(supabase, sub, null, opts);
  return true;
}

/** Record a coupon redemption once per PaymentIntent — completing the
 *  reservation create-payment-intent made, or inserting one if none exists. */
export async function recordCouponRedemption(supabase: any, userId: string, pi: any) {
  const couponId = pi.metadata?.couponId;
  if (!couponId) return;
  const discountAmount = Number(pi.metadata?.discountAmount || 0);
  const { data: existingRedemption } = await supabase
    .from("coupon_redemptions")
    .select("id, status")
    .eq("payment_intent_id", pi.id)
    .limit(1);
  const existing = existingRedemption?.[0];
  if (existing) {
    if (existing.status !== "completed") {
      const { error } = await supabase
        .from("coupon_redemptions")
        .update({ status: "completed", amount_discounted: discountAmount, redeemed_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) console.error("Failed to complete coupon reservation:", error);
    }
    return;
  }
  const { error } = await supabase.from("coupon_redemptions").insert({
    coupon_id: couponId,
    user_id: userId,
    payment_intent_id: pi.id,
    amount_discounted: discountAmount,
    status: "completed",
  });
  if (error) console.error("Failed to record coupon redemption:", error);
}

/**
 * Camp run as the parent should read it, e.g. "Mon 27 Jul – Fri 31 Jul";
 * a one-day camp shows the single date rather than repeating it.
 */
function campDates(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };
  const from = fmt(start);
  if (!from) return null;
  const to = end && end !== start ? fmt(end) : null;
  return to ? `${from} – ${to}` : from;
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
          dates: campDates(b.camps?.start_date, b.camps?.end_date),
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
          dates: null,
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
