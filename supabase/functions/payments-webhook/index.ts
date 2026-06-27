import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "payment_status:", session.payment_status);

  if (session.payment_status !== "paid") {
    console.log("Payment not yet paid, skipping booking creation");
    return;
  }

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in session metadata");
    return;
  }

  let cartItems: any[] = [];

  const compactItems = Object.entries(session.metadata || {})
    .filter(([key]) => key.startsWith("item_"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  if (compactItems.length > 0) {
    try {
      cartItems = compactItems
        .map(([, value]) => JSON.parse(String(value)))
        .filter((item) => item?.c)
        .map((item) => ({
          classId: item.c,
          studentId: item.s || null,
          pricingPlan: item.p || "session",
          totalPrice: Number(item.t || 0),
        }));
    } catch {
      console.error("Failed to parse compact cart item metadata");
      return;
    }
  } else {
    try {
      cartItems = JSON.parse(session.metadata?.cartItems || "[]");
    } catch {
      console.error("Failed to parse cartItems metadata");
      return;
    }
  }

  // Create bookings for each cart item
  let totalAmount = 0;
  for (const item of cartItems) {
    // Idempotency guard: skip if an active booking already exists for this
    // (parent/student, class) — prevents duplicate bookings from accidental
    // double-charges or repeat webhook deliveries.
    const dupQuery = supabase
      .from("bookings")
      .select("id")
      .eq("class_id", item.classId)
      .eq("parent_id", userId)
      .in("status", ["confirmed", "pending_payment"]);
    if (item.studentId) {
      dupQuery.eq("student_id", item.studentId);
    } else {
      dupQuery.is("student_id", null);
    }
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      console.log(
        "Skipping duplicate booking (checkout) for class:",
        item.classId,
        "student:",
        item.studentId,
        "existing:",
        existing.id,
      );
      continue;
    }

    const { error } = await supabase.from("bookings").insert({
      class_id: item.classId,
      student_id: item.studentId || null,
      parent_id: userId,
      status: "confirmed",
      booking_type: item.pricingPlan || "session",
      amount: item.totalPrice,
      notes: `Stripe session: ${session.id}`,
    });

    if (error) {
      console.error("Failed to create booking:", error);
    } else {
      totalAmount += Number(item.totalPrice || 0);
      console.log("Booking created for class:", item.classId);
    }
  }

  // Fire branded confirmation email (non-blocking on failure)
  await sendBookingConfirmationEmail(userId, session.id, totalAmount || null);
}

async function sendBookingConfirmationEmail(
  userId: string,
  reference: string,
  totalAmount: number | null,
) {
  try {
    // Look up parent profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.email) {
      console.warn("No profile email found for user, skipping confirmation email:", userId);
      return;
    }

    // Look up bookings for this reference
    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        `id, booking_type, amount, notes,
         classes:class_id ( name, start_time, end_time, day_of_week,
                            venues:venue_id ( name, city ) ),
         students:student_id ( first_name, last_name )`,
      )
      .ilike("notes", `%${reference}%`);

    if (!bookings || bookings.length === 0) {
      console.warn("No bookings found for reference, skipping email:", reference);
      return;
    }

    const emailPayload = {
      template: "booking_confirmation",
      to: profile.email,
      data: {
        parentName: profile.full_name,
        email: profile.email,
        totalAmount,
        reference,
        bookings: bookings.map((b: any) => ({
          className: b.classes?.name || "Class",
          studentName: b.students
            ? `${b.students.first_name} ${b.students.last_name}`
            : null,
          dayOfWeek: b.classes?.day_of_week || null,
          startTime: b.classes?.start_time || null,
          endTime: b.classes?.end_time || null,
          venueName: b.classes?.venues?.name || null,
          venueCity: b.classes?.venues?.city || null,
          bookingType: b.booking_type,
          amount: b.amount,
        })),
      },
    };

    const { error } = await supabase.functions.invoke("send-email", {
      body: emailPayload,
    });

    if (error) {
      console.error("Failed to send confirmation email:", error);
    } else {
      console.log("Confirmation email sent to:", profile.email);
    }
  } catch (e) {
    console.error("Error sending confirmation email:", e);
  }
}

async function handlePaymentIntentSucceeded(pi: any) {
  console.log("PaymentIntent succeeded:", pi.id);

  const userId = pi.metadata?.userId;
  if (!userId) {
    console.error("No userId in PaymentIntent metadata");
    return;
  }

  // Record coupon redemption if applicable
  const couponId = pi.metadata?.couponId;
  const discountAmount = Number(pi.metadata?.discountAmount || 0);
  if (couponId) {
    const { error: redErr } = await supabase.from("coupon_redemptions").insert({
      coupon_id: couponId,
      user_id: userId,
      payment_intent_id: pi.id,
      amount_discounted: discountAmount,
    });
    if (redErr) {
      console.error("Failed to record coupon redemption:", redErr);
    } else {
      console.log("Coupon redemption recorded:", couponId);
    }
  }

  const compactItems = Object.entries(pi.metadata || {})
    .filter(([key]) => key.startsWith("item_"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  let cartItems: any[] = [];
  try {
    cartItems = compactItems
      .map(([, value]) => JSON.parse(String(value)))
      .filter((item) => item?.c)
      .map((item) => ({
        classId: item.c,
        studentId: item.s || null,
        pricingPlan: item.p || "session",
        totalPrice: Number(item.t || 0),
      }));
  } catch {
    console.error("Failed to parse compact cart item metadata");
    return;
  }

  let totalAmount = 0;
  for (const item of cartItems) {
    const dupQuery = supabase
      .from("bookings")
      .select("id")
      .eq("class_id", item.classId)
      .eq("parent_id", userId)
      .in("status", ["confirmed", "pending_payment"]);
    if (item.studentId) {
      dupQuery.eq("student_id", item.studentId);
    } else {
      dupQuery.is("student_id", null);
    }
    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      console.log(
        "Skipping duplicate booking (PI) for class:",
        item.classId,
        "student:",
        item.studentId,
        "existing:",
        existing.id,
      );
      continue;
    }

    const { error } = await supabase.from("bookings").insert({
      class_id: item.classId,
      student_id: item.studentId || null,
      parent_id: userId,
      status: "confirmed",
      booking_type: item.pricingPlan || "session",
      amount: item.totalPrice,
      notes: `Stripe PaymentIntent: ${pi.id}`,
    });

    if (error) {
      console.error("Failed to create booking:", error);
    } else {
      totalAmount += Number(item.totalPrice || 0);
      console.log("Booking created for class:", item.classId);
    }
  }

  // Use the actual amount charged (after discount) when available
  const charged = pi.amount_received != null ? pi.amount_received / 100 : totalAmount;
  await sendBookingConfirmationEmail(userId, pi.id, charged || null);
}
