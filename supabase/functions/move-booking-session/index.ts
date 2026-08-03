// Move a single dated booking (pay-as-you-go session, drop-in or trial) to a
// different upcoming session. Trials stay within their class; PAYG bookings
// can also move to another bookable class of the same type at the same
// per-session price. The 24-hour cutoff is enforced in London time on BOTH
// the session being left and the target session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sessionPrice } from "../_shared/pricing.ts";

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

// Class times are stored as London wall-clock times — shift by the London UTC
// offset in force on that date (0 in winter, +1h during BST) to compare with now.
const londonOffsetMs = (dateStr: string) => {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const londonHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(probe));
  return (londonHour - 12) * 3600_000;
};
const sessionStartUtc = (dateStr: string, time: string | null) =>
  new Date(Date.parse(`${dateStr}T${(time ?? "00:00").slice(0, 5)}:00Z`) - londonOffsetMs(dateStr));

const MOVE_CUTOFF_MS = 24 * 3600_000;

const CLASS_FIELDS =
  "id, name, class_type, day_of_week, start_time, end_time, price_per_session, " +
  "is_active, status, publicly_visible, booking_enabled, invite_only";

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
      return jsonResponse({ error: "You must be signed in to move a session" }, 401);
    }

    const { bookingId, targetSessionId } = await req.json();
    if (!bookingId || typeof bookingId !== "string" || !targetSessionId || typeof targetSessionId !== "string") {
      return jsonResponse({ error: "Missing booking or target session", code: "not_found" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. The booking being moved — must be the caller's own, confirmed, a
    //    per-date booking type, and carry its session date in the notes.
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, parent_id, student_id, class_id, status, booking_type, notes")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking || booking.parent_id !== user.id) {
      return jsonResponse({ error: "Booking not found", code: "not_found" }, 400);
    }
    const dateMatch = /session (\d{4}-\d{2}-\d{2})/.exec(booking.notes ?? "");
    if (
      booking.status !== "confirmed" ||
      !["session", "drop_in", "trial"].includes(booking.booking_type) ||
      !booking.class_id ||
      !dateMatch
    ) {
      return jsonResponse({ error: "This booking can't be moved", code: "not_movable" }, 400);
    }
    const oldDate = dateMatch[1];

    // 2. 24-hour cutoff on the session being left. If the session row is
    //    missing, fall back to midnight on the booked date.
    const { data: oldSession } = await supabase
      .from("class_sessions")
      .select("session_date, start_time")
      .eq("class_id", booking.class_id)
      .eq("session_date", oldDate)
      .maybeSingle();
    const oldStart = sessionStartUtc(oldDate, oldSession?.start_time ?? null);
    if (Date.now() >= oldStart.getTime() - MOVE_CUTOFF_MS) {
      return jsonResponse({
        error: "Sessions can be moved up to 24 hours before the start time — this one is now locked. See you in class!",
        code: "too_late",
      }, 400);
    }

    // 3. The target session must be scheduled, ALSO at least 24h away, and its
    //    class open for booking.
    const { data: target } = await supabase
      .from("class_sessions")
      .select("id, class_id, session_date, start_time, status")
      .eq("id", targetSessionId)
      .maybeSingle();
    if (!target || target.status !== "scheduled") {
      return jsonResponse({ error: "That session isn't available", code: "target_unavailable" }, 400);
    }
    const targetStart = sessionStartUtc(target.session_date, target.start_time ?? null);
    if (Date.now() >= targetStart.getTime() - MOVE_CUTOFF_MS) {
      return jsonResponse({ error: "That session starts within 24 hours — please pick a later date", code: "target_unavailable" }, 400);
    }
    const { data: targetCls } = await supabase
      .from("classes")
      .select(CLASS_FIELDS)
      .eq("id", target.class_id)
      .maybeSingle();
    if (
      !targetCls || !targetCls.is_active || targetCls.status !== "confirmed" ||
      !targetCls.publicly_visible || !targetCls.booking_enabled || targetCls.invite_only
    ) {
      return jsonResponse({ error: "That class isn't open for booking right now", code: "target_unavailable" }, 400);
    }

    // 4. Plan rules: a trial stays within its class; a PAYG session can move
    //    to another class only when the class type and per-session price match.
    if (booking.booking_type === "trial") {
      if (targetCls.id !== booking.class_id) {
        return jsonResponse({ error: "A trial session can only move to another date of the same class", code: "wrong_class" }, 400);
      }
    } else {
      const { data: sourceCls } = await supabase
        .from("classes")
        .select(CLASS_FIELDS)
        .eq("id", booking.class_id)
        .maybeSingle();
      if (
        !sourceCls ||
        targetCls.class_type !== sourceCls.class_type ||
        sessionPrice(targetCls) !== sessionPrice(sourceCls)
      ) {
        return jsonResponse({
          error: "That class has a different session price — please book it separately instead.",
          code: "price_mismatch",
        }, 400);
      }
    }

    // 5. No doubling up: the same attendee can't already hold a confirmed
    //    booking for the target class on the target date.
    const targetDate = target.session_date;
    let dupQuery = supabase
      .from("bookings")
      .select("id")
      .eq("parent_id", user.id)
      .eq("class_id", targetCls.id)
      .eq("status", "confirmed")
      .ilike("notes", `%session ${targetDate}%`);
    dupQuery = booking.student_id
      ? dupQuery.eq("student_id", booking.student_id)
      : dupQuery.is("student_id", null);
    const { data: duplicate } = await dupQuery.limit(1).maybeSingle();
    if (duplicate) {
      return jsonResponse({
        error: `You're already booked into ${targetCls.name} on that date`,
        code: "already_booked",
      }, 400);
    }

    // 6. Move it: repoint the class and swap the dated notes marker. Clearing
    //    the reminder stamp lets the new date get its own reminder email.
    const newNotes = (booking.notes ?? "")
      .replace(`session ${oldDate}`, `session ${targetDate}`)
      .replace(" | reminder sent", "");
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ class_id: targetCls.id, notes: newNotes })
      .eq("id", booking.id);
    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      className: targetCls.name,
      sessionDate: targetDate,
      startTime: target.start_time,
    });
  } catch (error: any) {
    console.error("move-booking-session error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
