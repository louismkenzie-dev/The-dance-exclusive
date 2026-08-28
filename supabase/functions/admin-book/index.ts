// Admin-only: put someone on a class by hand.
//
// Two ways, chosen per booking:
//   record — the family has already paid (a Gymcatch class or package
//            carried over, a comp, cash at the door). Creates the booking
//            or class pass outright; no money moves.
//   invite — the family still owes: the booking is set up for them and they
//            get an email with a link that drops it straight into their
//            basket, so the ordinary checkout takes the payment. Monthly
//            memberships always go this way, because the card and the
//            Stripe subscription have to be created by that same flow.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ADULT_PASSES, type AdultPassType } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ONE_OFF_PLANS = ["trial", "session", "term", "yearly"];
const ALL_PLANS = [...ONE_OFF_PLANS, "monthly"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Not signed in" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return jsonResponse({ error: "Only admins can add bookings" }, 403);

    const body = await req.json();
    const { mode, userId, studentId, classId, plan, passType, note } = body;

    if (!userId || typeof userId !== "string") {
      return jsonResponse({ error: "Choose which customer this is for" }, 400);
    }
    const { data: parent } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!parent) return jsonResponse({ error: "Customer not found" }, 404);

    // The attendee must belong to this family — never book someone else's child.
    let student: any = null;
    if (studentId) {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name, parent_id, is_self")
        .eq("id", studentId)
        .maybeSingle();
      if (!data) return jsonResponse({ error: "Attendee not found" }, 404);
      if (data.parent_id !== userId) {
        return jsonResponse({ error: "That attendee belongs to a different account" }, 400);
      }
      student = data;
    }

    // ---------------------------------------------------------------
    // Adult class packs (a Gymcatch package carried over).
    // ---------------------------------------------------------------
    if (passType) {
      const pass = ADULT_PASSES[passType as AdultPassType];
      if (!pass) return jsonResponse({ error: "Unknown class pass" }, 400);
      if (mode !== "record") {
        return jsonResponse({ error: "Class packs can only be recorded as already paid" }, 400);
      }
      const sessions = Number(body.sessionsRemaining);
      const remaining = Number.isFinite(sessions) && sessions > 0
        ? Math.min(Math.round(sessions), pass.sessions)
        : pass.sessions;
      const expiryDays = Number(body.expiryDays);
      const windowDays = Number.isFinite(expiryDays) && expiryDays > 0
        ? Math.round(expiryDays)
        : (pass.windowDays ?? 42);

      const { data: created, error } = await supabase
        .from("class_passes")
        .insert({
          user_id: userId,
          student_id: studentId ?? null,
          pass_type: passType,
          sessions_total: pass.sessions,
          sessions_remaining: remaining,
          amount_paid: Number(body.amount) || 0,
          expires_at: new Date(Date.now() + windowDays * 86400000).toISOString(),
          // Marks the origin so it's never mistaken for a Stripe purchase.
          payment_intent_id: `admin:${crypto.randomUUID()}`,
          cart_item_ref: note ? String(note).slice(0, 80) : "added by admin",
        })
        .select("id")
        .single();
      if (error) {
        console.error("admin-book pass insert failed:", error);
        return jsonResponse({ error: "Could not add the class pack" }, 500);
      }
      return jsonResponse({ success: true, passId: created.id, remaining });
    }

    // ---------------------------------------------------------------
    // Class bookings.
    // ---------------------------------------------------------------
    if (!classId || typeof classId !== "string") {
      return jsonResponse({ error: "Choose a class" }, 400);
    }
    // Every class place belongs to a dancer — adults have their own "self"
    // profile, so there is always one to pick.
    if (!student) {
      return jsonResponse({ error: "Choose who the class is for" }, 400);
    }
    if (!ALL_PLANS.includes(plan)) {
      return jsonResponse({ error: `Unknown plan "${plan}"` }, 400);
    }
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, class_type, is_active")
      .eq("id", classId)
      .maybeSingle();
    if (!cls || !cls.is_active) {
      return jsonResponse({ error: "That class isn't available" }, 400);
    }

    const dates: string[] = Array.isArray(body.sessionDates)
      ? [...new Set(body.sessionDates.map((d: unknown) => String(d)))]
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
      : [];

    if (mode === "record") {
      if (plan === "monthly") {
        return jsonResponse({
          error:
            "Monthly memberships need a card on file, so they can't be recorded by hand — " +
            "use \"send them a payment link\" and the membership is set up when they pay.",
          code: "monthly_needs_link",
        }, 400);
      }
      if ((plan === "trial" || plan === "session") && dates.length === 0) {
        return jsonResponse({ error: "Pick which date(s) they're coming to" }, 400);
      }

      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return jsonResponse({ error: "Set the amount they paid (0 for a free place)" }, 400);
      }
      const reason = typeof note === "string" && note.trim()
        ? note.trim().slice(0, 200)
        : "Added by admin";

      // Dated plans become one booking per date, matching how the checkout
      // fulfils them, so registers and the 24-hour move rule behave normally.
      const rows = (dates.length > 0 ? dates : [null]).map((date, i, all) => ({
        class_id: classId,
        student_id: studentId,
        parent_id: userId,
        status: "confirmed",
        booking_type: plan,
        // Split the amount across dates; the last one absorbs the rounding.
        amount: all.length > 1
          ? (i === all.length - 1
            ? Math.round((amount - Math.floor((amount / all.length) * 100) / 100 * (all.length - 1)) * 100) / 100
            : Math.floor((amount / all.length) * 100) / 100)
          : amount,
        notes: date ? `${reason} | session ${date}` : reason,
      }));

      const { data: created, error } = await supabase
        .from("bookings")
        .insert(rows)
        .select("id");
      if (error) {
        console.error("admin-book booking insert failed:", error);
        return jsonResponse({ error: "Could not create the booking" }, 500);
      }
      return jsonResponse({ success: true, bookingIds: (created ?? []).map((b: any) => b.id) });
    }

    if (mode === "invite") {
      const price = Number(body.amount);
      const { data: invite, error } = await supabase
        .from("class_invites")
        .insert({
          class_id: classId,
          student_id: studentId,
          parent_id: userId,
          invited_by: user.id,
          price: Number.isFinite(price) && price >= 0 ? price : 0,
          plan,
          session_dates: dates.length > 0 ? dates : null,
        })
        .select("id")
        .single();
      if (error || !invite) {
        console.error("admin-book invite insert failed:", error);
        return jsonResponse({ error: "Could not set up the booking" }, 500);
      }

      let emailSent = false;
      if (parent.email) {
        const { error: emailErr } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "admin_booking_ready",
            to: parent.email,
            data: {
              parentName: parent.full_name,
              attendeeName: student
                ? (student.preferred_name || student.first_name)
                : null,
              className: cls.name,
              plan,
              sessionDates: dates.length > 0 ? dates : null,
              price: Number.isFinite(price) ? price : null,
              message: typeof note === "string" ? note.trim() : null,
            },
          },
        });
        emailSent = !emailErr;
        if (emailErr) console.error("admin-book email failed:", emailErr);
      }

      return jsonResponse({ success: true, inviteId: invite.id, emailSent });
    }

    return jsonResponse({ error: `Unknown mode "${mode}"` }, 400);
  } catch (e: any) {
    console.error("admin-book error:", e);
    return jsonResponse({ error: e?.message ?? "Something went wrong" }, 500);
  }
});
