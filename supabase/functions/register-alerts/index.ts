// Register alerts (invoked by pg_cron every five minutes).
//
// For each of today's scheduled class sessions (Europe/London):
// 1. Fifteen minutes after the start, any dancer on the register who has not
//    been marked arrived or absent → a "register check" email to the studio
//    owner.
// 2. Fifteen minutes after the end, any dancer marked arrived but not
//    departed → an URGENT email.
//
// Each session gets at most one email per kind: the check claims a row in
// register_alerts first, so a re-run or an overlapping invocation can never
// send twice. Sessions whose window closed more than three hours ago are
// left alone — an alert that late is noise, not help.
//
// Body options (all optional):
//   { "dry": true }              compute and report, send nothing, claim nothing
//   { "test_to": "me@x.com" }    send to this address instead of the owner and
//                                claim nothing, so the real alert still goes out
//   { "at": "2026-09-07T17:30:00Z" }
//                                pretend it is this instant — honoured only with
//                                dry or test_to, so a real run always uses now
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GRACE_MINUTES = 15;
const STALE_MINUTES = 180;
const APP_URL = "https://app.thedanceexclusive.co.uk";

type Kind = "not_marked_present" | "not_departed";

/** A London-local date + time as an instant. */
function londonToUtc(date: string, time: string): Date {
  const guess = new Date(`${date}T${time.slice(0, 8)}Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asLondon = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = asLondon - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

serve(async (req) => {
  let opts: { dry?: boolean; test_to?: string; at?: string } = {};
  try { opts = (await req.json()) ?? {}; } catch { /* no body */ }
  const dry = !!opts.dry;
  const testTo = typeof opts.test_to === "string" && opts.test_to.includes("@") ? opts.test_to : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const pretend = (dry || testTo) && typeof opts.at === "string" && !Number.isNaN(Date.parse(opts.at)) ? new Date(opts.at) : null;
  const now = pretend ?? new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  const summary = {
    date: today,
    now: now.toISOString(),
    dry,
    testTo: !!testTo,
    sessionsChecked: 0,
    presentAlerts: 0,
    departedAlerts: 0,
    emails: 0,
    errors: 0,
    details: [] as Record<string, unknown>[],
  };

  const { data: sessions, error: sessErr } = await supabase
    .from("class_sessions")
    .select("id, class_id, session_date, start_time, end_time, classes:class_id ( name, venues:venue_id ( name ) )")
    .eq("session_date", today)
    .eq("status", "scheduled");
  if (sessErr) {
    console.error("register-alerts: sessions query failed", sessErr);
    return new Response(JSON.stringify({ success: false, error: sessErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Which sessions are due for which check right now.
  const due: { session: any; kind: Kind; at: Date }[] = [];
  for (const s of sessions ?? []) {
    const start = londonToUtc(s.session_date, s.start_time);
    const end = londonToUtc(s.session_date, s.end_time);
    const presentAt = new Date(start.getTime() + GRACE_MINUTES * 60_000);
    const departedAt = new Date(end.getTime() + GRACE_MINUTES * 60_000);
    const stale = now.getTime() - STALE_MINUTES * 60_000;
    if (presentAt.getTime() <= now.getTime() && presentAt.getTime() >= stale) due.push({ session: s, kind: "not_marked_present", at: presentAt });
    if (departedAt.getTime() <= now.getTime() && departedAt.getTime() >= stale) due.push({ session: s, kind: "not_departed", at: departedAt });
  }
  summary.sessionsChecked = (sessions ?? []).length;
  if (due.length === 0) {
    return new Response(JSON.stringify({ success: true, ...summary }), { headers: { "Content-Type": "application/json" } });
  }

  // Already handled?
  const { data: existing } = await supabase
    .from("register_alerts")
    .select("class_session_id, kind")
    .in("class_session_id", [...new Set(due.map((d) => d.session.id))]);
  const done = new Set((existing ?? []).map((e: any) => `${e.class_session_id}:${e.kind}`));

  // Who hears about it: the owner. Falls back to the studio address.
  let recipients: string[] = [];
  if (testTo) {
    recipients = [testTo];
  } else {
    const { data: owners } = await supabase
      .from("staff")
      .select("email")
      .eq("role", "ceo_owner")
      .eq("is_active", true)
      .not("email", "is", null);
    recipients = [...new Set((owners ?? []).map((o: any) => String(o.email).trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0) {
      const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "email_address").maybeSingle();
      if (setting?.value) recipients = [String(setting.value)];
    }
  }

  for (const item of due) {
    const s = item.session;
    const key = `${s.id}:${item.kind}`;
    if (done.has(key)) continue;
    try {
      // The register for this session, the same way the staff screen builds
      // it: confirmed bookings on the class, per-date bookings (trial, pass,
      // birthday) only on their own date.
      const [{ data: bookings }, { data: attendance }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, student_id, notes, students:student_id ( first_name, last_name, preferred_name, is_self )")
          .eq("class_id", s.class_id)
          .eq("status", "confirmed"),
        supabase
          .from("attendance")
          .select("booking_id, status, checked_in_at, checked_out_at, collector_name")
          .eq("class_session_id", s.id),
      ]);
      const register = (bookings ?? []).filter((b: any) => {
        const m = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes || "");
        return !m || m[1] === s.session_date;
      });
      const attByBooking = new Map<string, any>((attendance ?? []).map((a: any) => [a.booking_id, a]));
      const nameOf = (b: any) => {
        const st = b.students;
        if (!st) return "Adult attendee";
        const first = st.preferred_name || st.first_name;
        return `${first} ${st.last_name ?? ""}`.trim() + (st.is_self ? " (adult)" : "");
      };

      let attendees: { name: string; detail?: string | null }[] = [];
      if (item.kind === "not_marked_present") {
        attendees = register
          .filter((b: any) => {
            const a = attByBooking.get(b.id);
            return !a || (a.status !== "absent" && !a.checked_in_at);
          })
          .map((b: any) => ({ name: nameOf(b), detail: "Not marked in or absent" }));
      } else {
        attendees = register
          .filter((b: any) => {
            const a = attByBooking.get(b.id);
            return a && a.status !== "absent" && a.checked_in_at && !a.checked_out_at;
          })
          .map((b: any) => {
            const a = attByBooking.get(b.id);
            return { name: nameOf(b), detail: `In ${fmtTime(new Date(a.checked_in_at))}${a.collector_name ? ` · ${a.collector_name}` : ""}` };
          });
      }
      attendees.sort((a, b) => a.name.localeCompare(b.name));

      const shouldEmail = register.length > 0 && attendees.length > 0 && recipients.length > 0;

      // Claim first (real runs only) — a duplicate claim means another run
      // got here, so send nothing.
      if (!dry && !testTo) {
        const { data: claim, error: claimErr } = await supabase
          .from("register_alerts")
          .upsert(
            { class_session_id: s.id, kind: item.kind, attendee_count: attendees.length, recipients: shouldEmail ? recipients : [], emailed: false, details: { attendees, registerSize: register.length, dueAt: item.at.toISOString() } },
            { onConflict: "class_session_id,kind", ignoreDuplicates: true },
          )
          .select("id");
        if (claimErr) throw claimErr;
        if (!claim || claim.length === 0) continue;
      }

      let emailed = 0;
      if (shouldEmail && !dry) {
        // Teachers on the session (explicit override, else the class's usual staff).
        const { data: explicit } = await supabase.from("session_instructors").select("staff:staff_id ( first_name, full_name )").eq("session_id", s.id);
        let teachers = (explicit ?? []).map((r: any) => r.staff?.first_name || r.staff?.full_name).filter(Boolean);
        if (teachers.length === 0) {
          const { data: usual } = await supabase.from("class_instructors").select("staff:staff_id ( first_name, full_name )").eq("class_id", s.class_id);
          teachers = (usual ?? []).map((r: any) => r.staff?.first_name || r.staff?.full_name).filter(Boolean);
        }
        for (const to of recipients) {
          const { error } = await supabase.functions.invoke("send-email", {
            headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
            body: {
              template: "register_alert",
              to,
              data: {
                kind: item.kind,
                className: s.classes?.name ?? "Class",
                sessionDate: s.session_date,
                startTime: s.start_time,
                endTime: s.end_time,
                venueName: s.classes?.venues?.name ?? null,
                instructorNames: teachers,
                attendees,
                registerSize: register.length,
                registerUrl: `${APP_URL}/admin/registers`,
              },
            },
          });
          if (error) throw error;
          emailed++;
        }
        if (!testTo) {
          await supabase.from("register_alerts").update({ emailed: true }).eq("class_session_id", s.id).eq("kind", item.kind);
        }
      }

      summary.emails += emailed;
      if (item.kind === "not_marked_present") summary.presentAlerts += attendees.length > 0 ? 1 : 0;
      else summary.departedAlerts += attendees.length > 0 ? 1 : 0;
      summary.details.push({
        session: s.id,
        className: s.classes?.name,
        time: `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`,
        kind: item.kind,
        registerSize: register.length,
        flagged: attendees.length,
        emailed,
      });
    } catch (e) {
      summary.errors++;
      console.error("register-alerts: failed for session", s.id, item.kind, e);
    }
  }

  console.log("register-alerts:", JSON.stringify({ ...summary, details: summary.details.length }));
  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
