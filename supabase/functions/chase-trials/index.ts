// Chasing a trial that hasn't booked yet — one family, or all of them.
//
// Amie: "How do I contact the trials again please?" The automatic follow-up
// goes out once, the evening of the class. After that the studio had nothing
// but its own memory, and no way to see who had already been asked.
//
// So: the same trial_follow_up email the cron sends, sent on purpose by a
// person, with every send recorded against the booking. Siblings who trialled
// the same class on the same night get one email between them, as they do
// automatically — a parent should not get two emails about one evening.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_URL = "https://app.thedanceexclusive.co.uk";

/** A second press of "Chase all" inside this window sends nothing. */
const RECHASE_COOLDOWN_HOURS = 6;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Result {
  bookingIds: string[];
  to?: string;
  studentName?: string | null;
  className?: string | null;
  sent: boolean;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

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
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return jsonResponse({ error: "Only admins can chase trials" }, 403);

    const body = await req.json().catch(() => ({}));
    const bookingIds: string[] = Array.isArray(body?.bookingIds)
      ? body.bookingIds.filter((x: unknown) => typeof x === "string")
      : [];
    const force = body?.force === true;
    if (bookingIds.length === 0) return jsonResponse({ error: "No trials selected" }, 400);
    if (bookingIds.length > 200) return jsonResponse({ error: "Too many trials in one go" }, 400);

    const { data: rows, error: rowsErr } = await supabase
      .from("bookings")
      .select(
        `id, parent_id, student_id, class_id, booked_at, notes, status, booking_type,
         students:student_id ( first_name, last_name, is_self ),
         classes:class_id ( name, class_type, venues:venue_id ( name ) )`,
      )
      .in("id", bookingIds)
      .eq("booking_type", "trial");
    if (rowsErr) return jsonResponse({ error: rowsErr.message }, 500);

    const trials = (rows ?? []) as any[];
    if (trials.length === 0) return jsonResponse({ error: "No trials found" }, 404);

    // One email per family per class per night, exactly as the cron groups them.
    const groups = new Map<string, any[]>();
    for (const b of trials) {
      if (b.status === "cancelled") continue;
      const date = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes || "")?.[1] ?? "";
      const key = `${b.parent_id}|${b.class_id}|${date}`;
      groups.set(key, [...(groups.get(key) ?? []), { ...b, _date: date }]);
    }

    const parentIds = [...new Set(trials.map((b) => b.parent_id).filter(Boolean))];
    const [{ data: profiles }, { data: noteSetting }, { data: recent }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds),
      supabase.from("app_settings").select("value").eq("key", "trial_follow_up_message").maybeSingle(),
      supabase
        .from("trial_chases")
        .select("booking_id, chased_at")
        .in("booking_id", trials.map((b) => b.id))
        .eq("method", "email")
        .gte(
          "chased_at",
          new Date(Date.now() - RECHASE_COOLDOWN_HOURS * 3600_000).toISOString(),
        ),
    ]);
    const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));
    const chasedRecently = new Set(((recent ?? []) as any[]).map((r) => r.booking_id as string));

    const results: Result[] = [];
    let sent = 0;

    for (const group of groups.values()) {
      const ids = group.map((b) => b.id as string);
      const first = group[0];
      const cls = first.classes;
      const parent = profileById.get(first.parent_id);
      const to = parent?.email as string | undefined;

      const names = group
        .map((b) => (b.students ? `${b.students.first_name} ${b.students.last_name}` : null))
        .filter(Boolean) as string[];
      const studentName = names.length === 0
        ? null
        : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

      if (!to) {
        results.push({ bookingIds: ids, studentName, className: cls?.name ?? null, sent: false, reason: "No email address on file" });
        continue;
      }
      // Guard the double-press. Pressing "Chase all" twice by accident must
      // not send a second email to a family who got one minutes ago.
      if (!force && ids.some((id) => chasedRecently.has(id))) {
        results.push({
          bookingIds: ids,
          to,
          studentName,
          className: cls?.name ?? null,
          sent: false,
          reason: `Already chased in the last ${RECHASE_COOLDOWN_HOURS} hours`,
        });
        continue;
      }

      const data = {
        parentName: parent?.full_name ?? null,
        studentName,
        className: cls?.name ?? "the class",
        sessionDate: first._date,
        venueName: cls?.venues?.name ?? null,
        classType: cls?.class_type ?? null,
        isSelf: group.length === 1 && !!first.students?.is_self,
        bookUrl: `${APP_URL}/classes/${cls?.class_type === "adult" ? "adult" : "children"}?class=${first.class_id}`,
        customMessage: noteSetting?.value ? String(noteSetting.value) : null,
      };

      const { data: sendResult, error } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
        body: {
          template: "trial_follow_up",
          to,
          data,
          meta: {
            parentId: first.parent_id,
            studentId: first.student_id,
            bookingId: first.id,
            classId: first.class_id,
            sentBy: user.id,
            source: "manual",
          },
        },
      });

      if (error) {
        console.error("chase-trials: send failed for", ids, error);
        results.push({ bookingIds: ids, to, studentName, className: cls?.name ?? null, sent: false, reason: "Email failed to send" });
        continue;
      }

      // One chase row per dancer, all pointing at the one email they shared.
      const logId = (sendResult as { logId?: string } | null)?.logId ?? null;
      const { error: chaseErr } = await supabase.from("trial_chases").insert(
        group.map((b) => ({
          booking_id: b.id,
          parent_id: b.parent_id,
          student_id: b.student_id,
          method: "email",
          email_log_id: logId,
          chased_by: user.id,
        })),
      );
      if (chaseErr) console.error("chase-trials: chase record failed for", ids, chaseErr.message);

      sent++;
      results.push({ bookingIds: ids, to, studentName, className: cls?.name ?? null, sent: true });
    }

    console.log("chase-trials:", JSON.stringify({ by: user.id, groups: groups.size, sent }));
    return jsonResponse({ sent, total: groups.size, results });
  } catch (e) {
    console.error("chase-trials error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
