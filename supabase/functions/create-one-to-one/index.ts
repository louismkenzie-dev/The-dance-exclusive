// Admin-only: create private one-to-one sessions and invite a specific child
// to them. Builds the whole thing in one call — an invite-only hidden class,
// a session per chosen date (1:1s often run weekly for a few weeks), the
// coach's register assignment, the invite row that unlocks checkout for that
// family, and the "You're invited" email to the parent. The parent books and
// pays for the whole set in the portal like any other class.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
    if (!adminRole) return jsonResponse({ error: "Only admins can create one-to-ones" }, 403);

    const body = await req.json();
    const { studentId, startTime, endTime, venueId, locationNote, staffId, price, title } = body;
    // Multi-date invites send `dates`; the original single `date` still works.
    const rawDates: unknown[] = Array.isArray(body.dates)
      ? body.dates
      : body.date != null ? [body.date] : [];

    if (!studentId || typeof studentId !== "string") {
      return jsonResponse({ error: "Choose which child to invite" }, 400);
    }
    const dates = [...new Set(rawDates.map((d) => String(d)))].sort();
    if (dates.length === 0 || !dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
      return jsonResponse({ error: "Pick at least one session date" }, 400);
    }
    if (dates.length > 26) {
      return jsonResponse({ error: "That's a lot of sessions for one invite — please split it into two." }, 400);
    }
    const timeRe = /^\d{2}:\d{2}$/;
    if (!timeRe.test(String(startTime ?? "")) || !timeRe.test(String(endTime ?? ""))) {
      return jsonResponse({ error: "Set a start and end time" }, 400);
    }
    if (String(endTime) <= String(startTime)) {
      return jsonResponse({ error: "The end time must be after the start time" }, 400);
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0.3) {
      return jsonResponse({ error: "Set a price of at least £0.30" }, 400);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dates[0] < today) {
      return jsonResponse({ error: "One of those dates is in the past" }, 400);
    }
    const customLocation = typeof locationNote === "string" && locationNote.trim()
      ? locationNote.trim().slice(0, 200)
      : null;

    const { data: student } = await supabase
      .from("students")
      .select("id, first_name, last_name, preferred_name, parent_id, is_self")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) return jsonResponse({ error: "Child not found" }, 404);

    // The coach taking the session: named in the title and put on the register.
    const { data: coach } = staffId
      ? await supabase.from("staff").select("id, first_name, full_name").eq("id", staffId).maybeSingle()
      : { data: null };
    const coachName = (coach as any)?.first_name || (coach as any)?.full_name?.split(" ")[0] || null;

    const childName = (student as any).preferred_name || (student as any).first_name;
    const className = (typeof title === "string" && title.trim())
      ? title.trim().slice(0, 80)
      : coachName
        ? `1:1 Session — ${childName} with ${coachName}`
        : `1:1 Session — ${childName}`;
    // The class day mirrors the first session; each date carries its own row.
    const dayOfWeek = DAY_NAMES[new Date(`${dates[0]}T00:00:00Z`).getUTCDay()];

    // The 1:1 lives as a hidden invite-only class holding one session per date.
    const { data: cls, error: classErr } = await supabase
      .from("classes")
      .insert({
        name: className,
        class_type: (student as any).is_self ? "adult" : "children",
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        venue_id: venueId || null,
        location_note: customLocation,
        price_per_session: priceNum,
        invite_only: true,
        publicly_visible: false,
        booking_enabled: true,
        is_active: true,
        status: "confirmed",
        allow_trial: false,
        sibling_discount_enabled: false,
      } as any)
      .select("id")
      .single();
    if (classErr || !cls) {
      console.error("create-one-to-one class insert failed:", classErr);
      return jsonResponse({ error: "Could not create the session — please try again" }, 500);
    }

    const { data: sessionRows, error: sessionErr } = await supabase
      .from("class_sessions")
      .insert(dates.map((d) => ({
        class_id: cls.id,
        session_date: d,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        status: "scheduled",
      })) as any)
      .select("id");
    if (sessionErr || !sessionRows?.length) {
      console.error("create-one-to-one session insert failed:", sessionErr);
      await supabase.from("classes").delete().eq("id", cls.id);
      return jsonResponse({ error: "Could not create the sessions — please try again" }, 500);
    }

    // Staffing: the coach appears on the register and the staffing timetable.
    if (coach) {
      const { error: staffErr } = await supabase
        .from("class_instructors")
        .insert({ class_id: cls.id, staff_id: (coach as any).id, instructor_role: "main" });
      if (staffErr) console.error("create-one-to-one staffing failed:", staffErr);
    }

    const { data: invite, error: inviteErr } = await supabase
      .from("class_invites")
      .insert({
        class_id: cls.id,
        student_id: studentId,
        parent_id: (student as any).parent_id,
        invited_by: user.id,
        price: priceNum,
      })
      .select("id")
      .single();
    if (inviteErr || !invite) {
      console.error("create-one-to-one invite insert failed:", inviteErr);
      await supabase.from("classes").delete().eq("id", cls.id);
      return jsonResponse({ error: "Could not create the invite — please try again" }, 500);
    }

    // Email the parent. Creation still succeeds if the email doesn't send —
    // the invite shows in their portal either way.
    let emailSent = false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", (student as any).parent_id)
      .maybeSingle();
    const { data: venue } = venueId
      ? await supabase.from("venues").select("name").eq("id", venueId).maybeSingle()
      : { data: null };
    if (profile?.email) {
      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
        body: {
          template: "one_to_one_invite",
          to: profile.email,
          data: {
            parentName: profile.full_name,
            childName,
            className,
            sessionDate: dates[0],
            sessionDates: dates,
            startTime: `${startTime}:00`,
            endTime: `${endTime}:00`,
            venueName: (venue as any)?.name ?? customLocation,
            coachName,
            price: priceNum,
          },
        },
      });
      emailSent = !emailErr;
      if (emailErr) console.error("create-one-to-one invite email failed:", emailErr);
    }

    return jsonResponse({
      success: true,
      classId: cls.id,
      sessionIds: (sessionRows as any[]).map((s) => s.id),
      sessionCount: sessionRows.length,
      inviteId: invite.id,
      emailSent,
    });
  } catch (error: any) {
    console.error("create-one-to-one error:", error);
    return jsonResponse({ error: error?.message ?? "Could not create the one-to-one" }, 500);
  }
});
