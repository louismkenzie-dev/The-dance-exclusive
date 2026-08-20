// Admin-only: create a private one-to-one session and invite a specific
// child to it. Builds the whole thing in one call — an invite-only hidden
// class, its single session, the invite row that unlocks checkout for that
// family, and the "You're invited" email to the parent. The parent then
// books and pays in the portal like any other class.
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

    const { studentId, date, startTime, endTime, venueId, price, title } = await req.json();

    if (!studentId || typeof studentId !== "string") {
      return jsonResponse({ error: "Choose which child to invite" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) {
      return jsonResponse({ error: "Pick a session date" }, 400);
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
    if (String(date) < today) {
      return jsonResponse({ error: "The session date is in the past" }, 400);
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, first_name, last_name, preferred_name, parent_id, is_self")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) return jsonResponse({ error: "Child not found" }, 404);

    const childName = (student as any).preferred_name || (student as any).first_name;
    const className = (typeof title === "string" && title.trim())
      ? title.trim().slice(0, 80)
      : `1:1 Session — ${childName}`;
    const dayOfWeek = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];

    // The 1:1 lives as a hidden invite-only class with exactly one session.
    const { data: cls, error: classErr } = await supabase
      .from("classes")
      .insert({
        name: className,
        class_type: (student as any).is_self ? "adult" : "children",
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        venue_id: venueId || null,
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

    const { data: session, error: sessionErr } = await supabase
      .from("class_sessions")
      .insert({
        class_id: cls.id,
        session_date: date,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        status: "scheduled",
      } as any)
      .select("id")
      .single();
    if (sessionErr || !session) {
      console.error("create-one-to-one session insert failed:", sessionErr);
      await supabase.from("classes").delete().eq("id", cls.id);
      return jsonResponse({ error: "Could not create the session — please try again" }, 500);
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
            sessionDate: date,
            startTime: `${startTime}:00`,
            endTime: `${endTime}:00`,
            venueName: (venue as any)?.name ?? null,
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
      sessionId: session.id,
      inviteId: invite.id,
      emailSent,
    });
  } catch (error: any) {
    console.error("create-one-to-one error:", error);
    return jsonResponse({ error: error?.message ?? "Could not create the one-to-one" }, 500);
  }
});
