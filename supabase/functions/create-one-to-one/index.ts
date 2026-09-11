// Admin-only: create a private session and invite the dancers who are on it.
// Builds the whole thing in one call — an invite-only hidden class, a session
// per chosen date (privates often run weekly for a few weeks), the coach's
// register assignment, an invite row per dancer that unlocks checkout for
// their family, and the "You're invited" email to each parent. Every family
// books and pays for their own dancer in the portal like any other class.
//
// A private is not always one child. Amie runs duos, trios and quad rehearsal
// privates, and until now the only way to sell one was to create the same
// session once per child — which put the same hour on the timetable two,
// three, four times over. One class, several dancers on it, each paying their
// own way, is what this builds.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { listNames, MAX_DANCERS, privateClassName } from "../_shared/privateSession.ts";

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
    const { startTime, endTime, venueId, locationNote, staffId, price, title } = body;
    // Multi-date invites send `dates`; the original single `date` still works.
    const rawDates: unknown[] = Array.isArray(body.dates)
      ? body.dates
      : body.date != null ? [body.date] : [];
    // A duo/trio/quad sends `studentIds`; a single `studentId` still works.
    const rawStudentIds: unknown[] = Array.isArray(body.studentIds)
      ? body.studentIds
      : body.studentId != null ? [body.studentId] : [];

    const studentIds = [...new Set(
      rawStudentIds.filter((id) => typeof id === "string" && id.trim()).map((id) => String(id)),
    )];
    if (studentIds.length === 0) {
      return jsonResponse({ error: "Choose which dancer the session is for" }, 400);
    }
    if (studentIds.length > MAX_DANCERS) {
      return jsonResponse({
        error: `A private holds up to ${MAX_DANCERS} dancers — set this one up as a class instead.`,
      }, 400);
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

    const { data: studentRows } = await supabase
      .from("students")
      .select("id, first_name, last_name, preferred_name, parent_id, is_self")
      .in("id", studentIds);
    const found = new Map(((studentRows as any[]) ?? []).map((s) => [s.id, s]));
    // Kept in the order the studio picked them, so the session is named the
    // way they read the names out.
    const students = studentIds.map((id) => found.get(id)).filter(Boolean) as any[];
    if (students.length !== studentIds.length) {
      return jsonResponse({
        error: students.length === 0 ? "Child not found" : "One of those dancers no longer exists — pick them again",
      }, 404);
    }
    if (students.some((s) => !s.parent_id)) {
      return jsonResponse({ error: "One of those dancers has no parent account to invite" }, 400);
    }

    // The coach taking the session: named in the title and put on the register.
    const { data: coach } = staffId
      ? await supabase.from("staff").select("id, first_name, full_name").eq("id", staffId).maybeSingle()
      : { data: null };
    const coachName = (coach as any)?.first_name || (coach as any)?.full_name?.split(" ")[0] || null;

    const firstNameOf = (s: any) => s.preferred_name || s.first_name;
    const dancerNames = students.map(firstNameOf);
    const className = (typeof title === "string" && title.trim())
      ? title.trim().slice(0, 80)
      : privateClassName(dancerNames, coachName);
    // The class day mirrors the first session; each date carries its own row.
    const dayOfWeek = DAY_NAMES[new Date(`${dates[0]}T00:00:00Z`).getUTCDay()];

    // The private lives as a hidden invite-only class holding one session per
    // date. Its capacity is exactly the dancers on it — a private is full the
    // moment it's created, and nothing should read it as having room.
    const { data: cls, error: classErr } = await supabase
      .from("classes")
      .insert({
        name: className,
        class_type: students.every((s) => s.is_self) ? "adult" : "children",
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        venue_id: venueId || null,
        location_note: customLocation,
        price_per_session: priceNum,
        capacity: students.length,
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

    // One invite per dancer, each priced for their own family. They go in as a
    // single statement so a private can never end up half-invited.
    const { data: invites, error: inviteErr } = await supabase
      .from("class_invites")
      .insert(students.map((s) => ({
        class_id: cls.id,
        student_id: s.id,
        parent_id: s.parent_id,
        invited_by: user.id,
        price: priceNum,
      })) as any)
      .select("id, student_id");
    if (inviteErr || !invites?.length) {
      console.error("create-one-to-one invite insert failed:", inviteErr);
      await supabase.from("classes").delete().eq("id", cls.id);
      return jsonResponse({ error: "Could not create the invite — please try again" }, 500);
    }

    // Email each family. Where one parent has two dancers on the session they
    // get one email naming both, not two nearly identical ones. Creation still
    // succeeds if an email doesn't send — the invite shows in their portal
    // either way.
    const byParent = new Map<string, any[]>();
    for (const s of students) {
      byParent.set(s.parent_id, [...(byParent.get(s.parent_id) ?? []), s]);
    }
    const parentIds = [...byParent.keys()];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", parentIds);
    const profileFor = new Map(((profiles as any[]) ?? []).map((p) => [p.user_id, p]));
    const { data: venue } = venueId
      ? await supabase.from("venues").select("name").eq("id", venueId).maybeSingle()
      : { data: null };

    let emailsSent = 0;
    for (const [parentId, mine] of byParent) {
      const profile = profileFor.get(parentId);
      if (!profile?.email) continue;
      const theirNames = mine.map(firstNameOf);
      const others = students.filter((s) => s.parent_id !== parentId).map(firstNameOf);
      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
        body: {
          template: "one_to_one_invite",
          to: profile.email,
          data: {
            parentName: profile.full_name,
            childName: listNames(theirNames),
            sharingWith: others,
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
      if (emailErr) console.error("create-one-to-one invite email failed:", emailErr);
      else emailsSent++;
    }

    return jsonResponse({
      success: true,
      classId: cls.id,
      sessionIds: (sessionRows as any[]).map((s) => s.id),
      sessionCount: sessionRows.length,
      // `inviteId` is the first dancer's, kept so an older caller still reads
      // something sensible; `inviteIds` is the real answer.
      inviteId: (invites as any[])[0]?.id,
      inviteIds: (invites as any[]).map((i) => i.id),
      studentCount: students.length,
      emailsSent,
      emailSent: emailsSent > 0,
    });
  } catch (error: any) {
    console.error("create-one-to-one error:", error);
    return jsonResponse({ error: error?.message ?? "Could not create the one-to-one" }, 500);
  }
});
