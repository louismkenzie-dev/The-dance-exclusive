// Register alerts (invoked by pg_cron every five minutes).
//
// For each of today's scheduled class sessions (Europe/London):
// 1. Fifteen minutes after the start, any dancer on the register who has not
//    been marked arrived or absent → a "register check" email to the studio.
// 2. Fifteen minutes after the end, any dancer marked arrived but not
//    departed → an URGENT email. Only while departures are recorded
//    (DEPARTURES below mirrors REGISTER_DEPARTURES in the app).
// 3. The moment a trialled class finishes, the family gets a "how was it —
//    here's how to keep the place" email. Once per trial (stamped on the
//    booking's notes), never to a family that has since booked, and any
//    trial from the last fortnight that was missed is caught up.
// 4. A few hours before an ADULT class starts with fewer than three booked
//    on → a "quiet class" email to the studio, with who is booked and a link
//    to the session's page. Children's classes run whatever the numbers.
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
/** Mirror of REGISTER_DEPARTURES in src/lib/registerRules.ts. */
const DEPARTURES = false;
/** How far back a missed trial follow-up is still worth sending. */
const FOLLOW_UP_LOOKBACK_DAYS = 14;
/** Mirror of QUIET_CLASS_THRESHOLD in src/lib/registerRules.ts: fewer adults
 *  than this booked on and the class is quiet. */
const QUIET_CLASS_THRESHOLD = 3;
/** How long before an adult class starts the studio hears it is quiet. */
const QUIET_NOTICE_HOURS = 3;

const londonYmd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

type Kind = "not_marked_present" | "not_departed" | "quiet_class";

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

/** "Trial", "Pay as you go", "Class pass" or "Weekly place", from a booking's notes. */
const planWord = (notes: string | null) => {
  const n = (notes ?? "").toLowerCase();
  if (n.includes("| trial")) return "Trial";
  if (n.includes("class pass")) return "Class pass";
  if (n.includes("birthday")) return "Birthday class";
  if (/session \d{4}-\d{2}-\d{2}/.test(n)) return "Pay as you go";
  return "Weekly place";
};

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
  const today = londonYmd(now);

  const summary = {
    date: today,
    now: now.toISOString(),
    dry,
    testTo: !!testTo,
    sessionsChecked: 0,
    presentAlerts: 0,
    departedAlerts: 0,
    quietAlerts: 0,
    followUps: 0,
    emails: 0,
    errors: 0,
    details: [] as Record<string, unknown>[],
  };

  // Who hears about the register: the studio's notice address, else the
  // owner's staff record, else the public contact address.
  let recipients: string[] = [];
  if (testTo) {
    recipients = [testTo];
  } else {
    const { data: notice } = await supabase.from("app_settings").select("value").eq("key", "ops_notice_email").maybeSingle();
    if (notice?.value && String(notice.value).includes("@")) recipients = [String(notice.value).trim().toLowerCase()];
    if (recipients.length === 0) {
      const { data: owners } = await supabase
        .from("staff")
        .select("email")
        .eq("role", "ceo_owner")
        .eq("is_active", true)
        .not("email", "is", null);
      recipients = [...new Set((owners ?? []).map((o: any) => String(o.email).trim().toLowerCase()).filter(Boolean))];
    }
    if (recipients.length === 0) {
      const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "email_address").maybeSingle();
      if (setting?.value) recipients = [String(setting.value)];
    }
  }

  const { data: sessions, error: sessErr } = await supabase
    .from("class_sessions")
    .select("id, class_id, session_date, start_time, end_time, classes:class_id ( name, class_type, invite_only, venues:venue_id ( name ) )")
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
    if (DEPARTURES && departedAt.getTime() <= now.getTime() && departedAt.getTime() >= stale) due.push({ session: s, kind: "not_departed", at: departedAt });
    // Adult classes only (a private one-to-one is meant to be small): from a
    // few hours before the start until it starts. Checked every run in that
    // window, so a late cancellation that leaves the class short is still
    // caught; claimed only once it is quiet.
    const quietAt = new Date(start.getTime() - QUIET_NOTICE_HOURS * 3_600_000);
    if (s.classes?.class_type === "adult" && !s.classes?.invite_only && quietAt.getTime() <= now.getTime() && start.getTime() > now.getTime()) {
      due.push({ session: s, kind: "quiet_class", at: quietAt });
    }
  }
  summary.sessionsChecked = (sessions ?? []).length;

  // Already handled?
  const done = new Set<string>();
  if (due.length > 0) {
    const { data: existing } = await supabase
      .from("register_alerts")
      .select("class_session_id, kind")
      .in("class_session_id", [...new Set(due.map((d) => d.session.id))]);
    for (const e of existing ?? []) done.add(`${(e as any).class_session_id}:${(e as any).kind}`);
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
      if (item.kind === "quiet_class") {
        // Enough booked on — nothing to say, and nothing claimed, so a
        // later drop below the line is still noticed.
        if (register.length >= QUIET_CLASS_THRESHOLD) continue;
        attendees = register.map((b: any) => ({ name: nameOf(b), detail: planWord(b.notes) }));
      } else if (item.kind === "not_marked_present") {
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

      // A quiet class is worth hearing about even when nobody is booked on;
      // a register check only when there is someone to chase.
      const shouldEmail = recipients.length > 0 &&
        (item.kind === "quiet_class" || (register.length > 0 && attendees.length > 0));

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
          const body = item.kind === "quiet_class"
            ? {
              template: "quiet_class",
              to,
              data: {
                className: s.classes?.name ?? "Class",
                sessionDate: s.session_date,
                startTime: s.start_time,
                endTime: s.end_time,
                venueName: s.classes?.venues?.name ?? null,
                instructorNames: teachers,
                booked: attendees,
                threshold: QUIET_CLASS_THRESHOLD,
                hoursAhead: QUIET_NOTICE_HOURS,
                sessionUrl: `${APP_URL}/admin/sessions/${s.id}`,
              },
            }
            : {
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
                registerUrl: `${APP_URL}/admin/registers?date=${s.session_date}&session=${s.id}`,
              },
            };
          const { error } = await supabase.functions.invoke("send-email", {
            headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
            body,
          });
          if (error) throw error;
          emailed++;
        }
        if (!testTo) {
          await supabase.from("register_alerts").update({ emailed: true }).eq("class_session_id", s.id).eq("kind", item.kind);
        }
      }

      summary.emails += emailed;
      if (item.kind === "quiet_class") summary.quietAlerts += 1;
      else if (item.kind === "not_marked_present") summary.presentAlerts += attendees.length > 0 ? 1 : 0;
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
      // A quiet-class notice that didn't send gives its claim back, so the
      // next run inside the window tries again. Register checks stay
      // one-shot — a chase that late is noise.
      if (item.kind === "quiet_class" && !dry && !testTo) {
        await supabase.from("register_alerts").delete().eq("class_session_id", s.id).eq("kind", "quiet_class").eq("emailed", false);
      }
    }
  }

  // ── Trial follow-ups ───────────────────────────────────────────────────
  try {
    const sinceYmd = londonYmd(new Date(now.getTime() - FOLLOW_UP_LOOKBACK_DAYS * 86_400_000));
    const { data: trials } = await supabase
      .from("bookings")
      .select("id, parent_id, student_id, class_id, booked_at, notes, students:student_id ( first_name, last_name, is_self ), classes:class_id ( name, class_type, venues:venue_id ( name ) )")
      .eq("booking_type", "trial")
      .eq("status", "confirmed")
      .ilike("notes", "%session 2%")
      .not("notes", "ilike", "%follow-up sent%")
      .not("notes", "ilike", "%follow-up skipped%");

    // One email per family per class per date — two children trialling the
    // same class together are one "how was it?", not two.
    type Group = { parentId: string; classId: string; date: string; bookings: any[] };
    const groups = new Map<string, Group>();
    for (const b of (trials ?? []) as any[]) {
      const date = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes || "")?.[1];
      if (!date || date < sinceYmd || date > today) continue;
      const key = `${b.parent_id}|${b.class_id}|${date}`;
      const g = groups.get(key) ?? { parentId: b.parent_id, classId: b.class_id, date, bookings: [] };
      g.bookings.push(b);
      groups.set(key, g);
    }

    if (groups.size > 0) {
      const classIds = [...new Set([...groups.values()].map((g) => g.classId))];
      const parentIds = [...new Set([...groups.values()].map((g) => g.parentId))];
      const trialIds = [...groups.values()].flatMap((g) => g.bookings.map((b) => b.id as string));
      const [{ data: sessRows }, { data: laterBookings }, { data: laterMemberships }, { data: profiles }, { data: noteSetting }, { data: absences }] = await Promise.all([
        supabase.from("class_sessions").select("class_id, session_date, end_time, status").in("class_id", classIds).gte("session_date", sinceYmd).lte("session_date", today),
        supabase.from("bookings").select("parent_id, booked_at").in("parent_id", parentIds).eq("status", "confirmed").in("booking_type", ["monthly", "term", "yearly", "session", "drop_in", "pass"]),
        supabase.from("memberships").select("user_id, created_at").in("user_id", parentIds).in("status", ["active", "paused", "past_due", "cancel_scheduled", "incomplete"]),
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds),
        supabase.from("app_settings").select("value").eq("key", "trial_follow_up_message").maybeSingle(),
        supabase.from("attendance").select("booking_id").in("booking_id", trialIds).eq("status", "absent"),
      ]);
      const sessionAt = new Map<string, { end: Date; status: string }>();
      for (const s of (sessRows ?? []) as any[]) sessionAt.set(`${s.class_id}|${s.session_date}`, { end: londonToUtc(s.session_date, s.end_time), status: s.status });
      const boughtAfter = (parentId: string, after: string) =>
        ((laterBookings ?? []) as any[]).some((x) => x.parent_id === parentId && x.booked_at > after) ||
        ((laterMemberships ?? []) as any[]).some((x) => x.user_id === parentId && x.created_at > after);
      const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));
      const absent = new Set(((absences ?? []) as any[]).map((a) => a.booking_id as string));

      let sentInTest = 0;
      for (const g of groups.values()) {
        const sess = sessionAt.get(`${g.classId}|${g.date}`);
        // Not finished yet, or never ran — nothing to follow up.
        if (!sess || sess.status === "cancelled" || sess.end.getTime() > now.getTime()) continue;
        // Marked absent on the register: they never came, so "how was it?"
        // would be wrong. Stamp it so it isn't looked at again.
        if (g.bookings.every((b) => absent.has(b.id))) {
          summary.details.push({ followUpSkipped: g.bookings.map((b) => b.id), reason: "absent", date: g.date });
          if (!dry && !testTo) {
            for (const b of g.bookings) {
              await supabase.from("bookings").update({ notes: `${b.notes} | follow-up skipped (absent)` }).eq("id", b.id)
                .not("notes", "ilike", "%follow-up s%");
            }
          }
          continue;
        }
        // They've booked something since the trial; the email did its job.
        const earliest = g.bookings.map((b) => b.booked_at).sort()[0];
        if (boughtAfter(g.parentId, earliest)) continue;
        const parent = profileById.get(g.parentId);
        const to = testTo ?? parent?.email;
        if (!to) continue;
        if (testTo && sentInTest >= 1) break; // one sample is plenty

        const first = g.bookings[0];
        const cls = first.classes;
        const names = g.bookings.map((b) => b.students ? `${b.students.first_name} ${b.students.last_name}` : null).filter(Boolean) as string[];
        const studentName = names.length === 0 ? null
          : names.length === 1 ? names[0]
          : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
        const data = {
          parentName: parent?.full_name ?? null,
          studentName,
          className: cls?.name ?? "the class",
          sessionDate: g.date,
          venueName: cls?.venues?.name ?? null,
          classType: cls?.class_type ?? null,
          isSelf: g.bookings.length === 1 && !!first.students?.is_self,
          bookUrl: `${APP_URL}/classes/${cls?.class_type === "adult" ? "adult" : "children"}?class=${g.classId}`,
          customMessage: noteSetting?.value ? String(noteSetting.value) : null,
        };
        summary.details.push({ followUp: g.bookings.map((b) => b.id), className: data.className, date: g.date, to: dry ? "(dry)" : to });
        if (dry) { summary.followUps++; continue; }

        // Stamp first, so an overlapping run can't send the same family
        // twice; a send that then fails is logged rather than repeated.
        if (!testTo) {
          let claimed = 0;
          for (const b of g.bookings) {
            const { data: rows } = await supabase
              .from("bookings")
              .update({ notes: `${b.notes} | follow-up sent` })
              .eq("id", b.id)
              .not("notes", "ilike", "%follow-up sent%")
              .select("id");
            claimed += rows?.length ?? 0;
          }
          if (claimed === 0) continue;
        }
        const { error } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: { template: "trial_follow_up", to, data },
        });
        if (error) {
          summary.errors++;
          console.error("register-alerts: follow-up failed for", g.bookings.map((b) => b.id), error);
          // Nothing reached the family, so give the claim back and let the
          // next run try again while the trial is still inside the window.
          if (!testTo) {
            for (const b of g.bookings) {
              await supabase.from("bookings").update({ notes: b.notes }).eq("id", b.id).ilike("notes", "%follow-up sent%");
            }
          }
          continue;
        }
        summary.followUps++;
        summary.emails++;
        if (testTo) sentInTest++;
      }
    }
  } catch (e) {
    summary.errors++;
    console.error("register-alerts: follow-ups failed", e);
  }

  console.log("register-alerts:", JSON.stringify({ ...summary, details: summary.details.length }));
  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
