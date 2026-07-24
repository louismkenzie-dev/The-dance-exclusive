// Admin-only: assign or unassign a staff member on a class from the staffing
// timetable. Assignment emails the staff member their class details and, when
// they already have a portal account, a direct link to the staff registers.
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

const PORTAL_URL = Deno.env.get("STAFF_PORTAL_URL") || "https://app.thedanceexclusive.co.uk";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!callerRoles?.some((r: any) => r.role === "admin")) {
      return jsonResponse({ error: "Forbidden — admin only" }, 403);
    }

    const { action = "assign", classId, staffId, instructorRole = "assistant" } = await req.json();
    if (!classId || !staffId) {
      return jsonResponse({ error: "classId and staffId are required" }, 400);
    }

    if (action === "unassign") {
      await admin
        .from("class_instructors")
        .delete()
        .eq("class_id", classId)
        .eq("staff_id", staffId);
      return jsonResponse({ success: true });
    }

    if (action !== "assign") return jsonResponse({ error: "Unknown action" }, 400);
    const role = instructorRole === "main" ? "main" : "assistant";

    const [{ data: cls }, { data: staff }] = await Promise.all([
      admin
        .from("classes")
        .select("id, name, day_of_week, start_time, end_time, venues:venue_id ( name, city )")
        .eq("id", classId)
        .maybeSingle(),
      admin
        .from("staff")
        .select("id, full_name, email, user_id, is_active")
        .eq("id", staffId)
        .maybeSingle(),
    ]);
    if (!cls) return jsonResponse({ error: "Class not found" }, 404);
    if (!staff) return jsonResponse({ error: "Staff member not found" }, 404);

    // One Main per class: promoting someone demotes the current Main.
    if (role === "main") {
      await admin
        .from("class_instructors")
        .update({ instructor_role: "assistant" })
        .eq("class_id", classId)
        .eq("instructor_role", "main")
        .neq("staff_id", staffId);
    }

    const { data: existing } = await admin
      .from("class_instructors")
      .select("id, instructor_role")
      .eq("class_id", classId)
      .eq("staff_id", staffId)
      .maybeSingle();

    let alreadyAssigned = false;
    if (existing) {
      alreadyAssigned = true;
      if (existing.instructor_role !== role) {
        await admin
          .from("class_instructors")
          .update({ instructor_role: role })
          .eq("id", existing.id);
      }
    } else {
      const { error: insErr } = await admin
        .from("class_instructors")
        .insert({ class_id: classId, staff_id: staffId, instructor_role: role });
      if (insErr) return jsonResponse({ error: insErr.message }, 400);
    }

    // Confirmation email (best effort) — only on a NEW assignment, so role
    // tweaks don't spam the teacher.
    let emailSent = false;
    if (!alreadyAssigned && staff.email) {
      const { error: mailErr } = await admin.functions.invoke("send-email", {
        headers: { "x-internal-auth": serviceKey },
        body: {
          template: "staff_class_assigned",
          to: staff.email,
          data: {
            staffName: staff.full_name,
            className: cls.name,
            dayOfWeek: cls.day_of_week,
            startTime: cls.start_time,
            endTime: cls.end_time,
            venueName: (cls as any).venues?.name ?? null,
            venueCity: (cls as any).venues?.city ?? null,
            instructorRole: role,
            // Register link only when they already have a portal account.
            portalLink: staff.user_id ? `${PORTAL_URL}/staff/registers` : null,
          },
        },
      });
      emailSent = !mailErr;
      if (mailErr) console.error("Assignment email failed:", mailErr);
    }

    return jsonResponse({ success: true, emailSent, alreadyAssigned });
  } catch (error: any) {
    console.error("assign-staff error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
