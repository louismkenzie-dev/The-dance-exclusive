// Redeem an adult multi-class pass (or the free birthday class) against
// specific upcoming sessions — creates confirmed bookings with no payment.
// All rules are enforced server-side:
//  - the pass must belong to the caller, be unexpired and have credits left
//  - sessions must be upcoming, scheduled, and belong to ADULT classes
//  - week_2 passes: both sessions must fall in the same calendar week (Mon–Sun)
//  - birthday: caller's self-profile birthday must be within the last 10 days,
//    one free class per year
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { BIRTHDAY_CLASS_WINDOW_DAYS } from "../_shared/pricing.ts";

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

/** Monday 00:00 of the week containing the given date (ISO date string). */
const mondayOfWeek = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
};

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
      return jsonResponse({ error: "You must be signed in to redeem a pass" }, 401);
    }

    const { mode, passId, sessionIds } = await req.json();
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return jsonResponse({ error: "Choose at least one session" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The caller's own attendee profile — pass/birthday classes are adult
    // self-bookings, so a complete self profile is required.
    const { data: selfStudent } = await supabase
      .from("students")
      .select("id, first_name, last_name, date_of_birth")
      .eq("parent_id", user.id)
      .eq("is_self", true)
      .maybeSingle();
    if (!selfStudent?.date_of_birth) {
      return jsonResponse({
        error: "Set up your attendee profile (including date of birth) in your account before redeeming.",
        code: "attendee_profile_required",
      }, 400);
    }

    // Load and validate the sessions: upcoming, scheduled, adult classes.
    const today = new Date().toISOString().split("T")[0];
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, class_id, session_date, status, classes:class_id (id, name, class_type, is_active, status, publicly_visible, booking_enabled, invite_only)")
      .in("id", [...new Set(sessionIds)]);
    if (!sessions || sessions.length !== new Set(sessionIds).size) {
      return jsonResponse({ error: "One of the chosen sessions no longer exists" }, 400);
    }
    for (const s of sessions as any[]) {
      if (s.status !== "scheduled" || s.session_date < today) {
        return jsonResponse({ error: "One of the chosen sessions is no longer available" }, 400);
      }
      const cls = s.classes;
      if (cls?.class_type !== "adult") {
        return jsonResponse({ error: "Passes can only be used for adult classes" }, 400);
      }
      if (!cls.is_active || cls.status !== "confirmed" || !cls.publicly_visible || !cls.booking_enabled || cls.invite_only) {
        return jsonResponse({ error: `${cls.name || "One of these classes"} is not open for booking` }, 400);
      }
    }

    if (mode === "birthday") {
      if (sessions.length !== 1) {
        return jsonResponse({ error: "The birthday offer covers one class" }, 400);
      }
      // Birthday must have occurred within the last BIRTHDAY_CLASS_WINDOW_DAYS.
      const dob = new Date(`${selfStudent.date_of_birth}T00:00:00Z`);
      const now = new Date();
      const thisYearBirthday = new Date(Date.UTC(now.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
      const lastBirthday = thisYearBirthday > now
        ? new Date(Date.UTC(now.getUTCFullYear() - 1, dob.getUTCMonth(), dob.getUTCDate()))
        : thisYearBirthday;
      const daysSince = Math.floor((now.getTime() - lastBirthday.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSince > BIRTHDAY_CLASS_WINDOW_DAYS) {
        return jsonResponse({
          error: `The free birthday class is valid for ${BIRTHDAY_CLASS_WINDOW_DAYS} days from your birthday.`,
        }, 400);
      }
      // One free birthday class per year.
      const yearAgo = new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000).toISOString();
      const { data: prior } = await supabase
        .from("bookings")
        .select("id")
        .eq("parent_id", user.id)
        .eq("booking_type", "birthday")
        .gte("created_at", yearAgo)
        .limit(1);
      if (prior && prior.length > 0) {
        return jsonResponse({ error: "You've already used your free birthday class this year" }, 400);
      }

      const session = sessions[0] as any;
      const { error } = await supabase.from("bookings").insert({
        class_id: session.class_id,
        student_id: selfStudent.id,
        parent_id: user.id,
        status: "confirmed",
        booking_type: "birthday",
        amount: 0,
        notes: `Birthday free class — session ${session.session_date}`,
      });
      if (error) throw error;
      return jsonResponse({ success: true, booked: 1, mode: "birthday" });
    }

    // ------------------------------------------------------------------
    // Pass redemption
    // ------------------------------------------------------------------
    if (!passId || typeof passId !== "string") {
      return jsonResponse({ error: "No pass selected" }, 400);
    }
    const { data: pass } = await supabase
      .from("class_passes")
      .select("*")
      .eq("id", passId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!pass) return jsonResponse({ error: "Pass not found" }, 404);
    if (new Date(pass.expires_at) < new Date()) {
      return jsonResponse({ error: "This pass has expired" }, 400);
    }
    if (pass.sessions_remaining < sessions.length) {
      return jsonResponse({
        error: `This pass has ${pass.sessions_remaining} class${pass.sessions_remaining === 1 ? "" : "es"} left`,
      }, 400);
    }

    // week_2 passes: every session (including any already redeemed) must fall
    // within one calendar week, Monday–Sunday.
    if (pass.pass_type === "week_2") {
      const weeks = new Set((sessions as any[]).map((s) => mondayOfWeek(s.session_date)));
      const { data: priorRedemptions } = await supabase
        .from("bookings")
        .select("notes")
        .eq("parent_id", user.id)
        .eq("booking_type", "pass")
        .ilike("notes", `%${pass.id}%`);
      for (const b of priorRedemptions ?? []) {
        const match = /session (\d{4}-\d{2}-\d{2})/.exec((b as any).notes || "");
        if (match) weeks.add(mondayOfWeek(match[1]));
      }
      if (weeks.size > 1) {
        return jsonResponse({
          error: "The 2-class pass covers classes in the same calendar week (Monday–Sunday)",
        }, 400);
      }
    }

    // Prevent double-booking the SAME session (not the same class — a pass is
    // meant to be used across repeated weeks of the same class). Bookings carry
    // the session date in their notes, so match on that specific date.
    for (const s of sessions as any[]) {
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("class_id", s.class_id)
        .eq("parent_id", user.id)
        .eq("student_id", selfStudent.id)
        .in("status", ["confirmed", "pending_payment"])
        .ilike("notes", `%session ${s.session_date}%`)
        .limit(1);
      if (existing && existing.length > 0) {
        return jsonResponse({
          error: `You're already booked into ${s.classes?.name || "one of these classes"} on that date`,
          code: "duplicate_booking",
        }, 409);
      }
    }

    // Atomically decrement credits (guard against concurrent redemptions).
    const { data: updated, error: updateError } = await supabase
      .from("class_passes")
      .update({
        sessions_remaining: pass.sessions_remaining - sessions.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pass.id)
      .eq("sessions_remaining", pass.sessions_remaining)
      .select("id");
    if (updateError || !updated || updated.length === 0) {
      return jsonResponse({ error: "Could not redeem the pass — please try again" }, 409);
    }

    let booked = 0;
    for (const s of sessions as any[]) {
      const { error } = await supabase.from("bookings").insert({
        class_id: s.class_id,
        student_id: selfStudent.id,
        parent_id: user.id,
        status: "confirmed",
        booking_type: "pass",
        amount: 0,
        notes: `Class pass ${pass.id} — session ${s.session_date}`,
      });
      if (error) {
        console.error("Pass booking insert failed:", error);
        // Give back the credits for the sessions that didn't get booked, using
        // an atomic relative increment so concurrent redemptions aren't clobbered.
        const toRefund = sessions.length - booked;
        if (toRefund > 0) {
          await supabase.rpc("refund_pass_credits", { p_pass_id: pass.id, p_amount: toRefund });
        }
        return jsonResponse({ error: "Could not complete all bookings — please contact us" }, 500);
      }
      booked++;
    }

    return jsonResponse({
      success: true,
      booked,
      remaining: pass.sessions_remaining - booked,
    });
  } catch (error: any) {
    console.error("redeem-pass error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
