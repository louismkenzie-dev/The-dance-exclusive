// Daily reminder emails (invoked by pg_cron each morning, ~9am UK time):
// 1. every trial booking whose chosen session is TOMORROW gets a friendly
//    reminder email, including the studio-written note stored in
//    app_settings.trial_reminder_message (editable by admins).
//    Idempotent: each booking is stamped "reminder sent" in its notes.
// 2. waitlist check: any class with un-notified waitlist entries and a free
//    standing place (confirmed monthly/term/yearly bookings < capacity)
//    triggers a "space has opened up" email; entries are stamped notified_at
//    so each parent is emailed once per opening (they re-join to hear again).
// 3. birthdays: every dancer (with at least one confirmed booking) whose
//    birthday is TODAY gets a happy-birthday email — children's wishes go to
//    the parent's inbox; adult dancers are emailed directly with a reminder
//    of their free birthday-week class. Idempotent via the birthday_emails
//    (student_id, year) claim table.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // "Tomorrow" in the studio's timezone, not UTC.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tomorrow = fmt.format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const todayLondon = fmt.format(new Date());

  const summary = {
    date: tomorrow,
    trialReminders: 0,
    skippedNoSession: 0,
    waitlistNotified: 0,
    birthdayEmails: 0,
    errors: 0,
  };

  const { data: pinnedBookings } = await supabase
    .from("bookings")
    .select(
      `id, parent_id, class_id, notes,
       students:student_id ( first_name, last_name, preferred_name, is_self ),
       classes:class_id ( name, start_time, end_time, class_type, venues:venue_id ( name ) )`,
    )
    .eq("status", "confirmed")
    .eq("booking_type", "trial")
    .ilike("notes", `%session ${tomorrow}%`)
    .not("notes", "ilike", "%reminder sent%");

  // Only remind about classes that are actually on tomorrow. A booking stays
  // pinned to its date even if the admin later removed or cancelled that
  // session, and telling a parent to turn up to a class that isn't running
  // is far worse than sending nothing. Skipped bookings are left unstamped
  // and logged so they show up if anyone goes looking.
  const pinnedClassIds = [...new Set((pinnedBookings ?? []).map((b: any) => b.class_id).filter(Boolean))];
  const runningClassIds = new Set<string>();
  if (pinnedClassIds.length > 0) {
    const { data: liveSessions } = await supabase
      .from("class_sessions")
      .select("class_id")
      .in("class_id", pinnedClassIds)
      .eq("session_date", tomorrow)
      .neq("status", "cancelled");
    for (const s of liveSessions ?? []) runningClassIds.add(s.class_id);
  }
  const bookings = (pinnedBookings ?? []).filter((b: any) => runningClassIds.has(b.class_id));
  for (const b of pinnedBookings ?? []) {
    if (runningClassIds.has(b.class_id)) continue;
    summary.skippedNoSession++;
    console.warn(
      `daily-reminders: booking ${b.id} is pinned to ${tomorrow} but class ${b.class_id} has no session that day — reminder NOT sent`,
    );
  }

  if ((bookings ?? []).length > 0) {
    const { data: msgRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "trial_reminder_message")
      .maybeSingle();
    const customMessage = (msgRow?.value ?? "").trim() || null;

    for (const b of bookings ?? []) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", b.parent_id)
          .maybeSingle();
        if (!profile?.email) continue;
        const student: any = b.students;
        const cls: any = b.classes;
        const { error } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "trial_reminder",
            to: profile.email,
            data: {
              parentName: profile.full_name,
              studentName: student
                ? (student.preferred_name || `${student.first_name} ${student.last_name}`)
                : null,
              className: cls?.name ?? "your class",
              sessionDate: tomorrow,
              startTime: cls?.start_time ?? null,
              endTime: cls?.end_time ?? null,
              venueName: cls?.venues?.name ?? null,
              classType: cls?.class_type ?? null,
              // An adult who booked themselves should be addressed directly,
              // not told about their own trial in the third person.
              isSelf: Boolean(student?.is_self),
              customMessage,
            },
          },
        });
        if (error) throw error;
        await supabase
          .from("bookings")
          .update({ notes: `${b.notes ?? ""} | reminder sent` })
          .eq("id", b.id);
        summary.trialReminders++;
      } catch (e) {
        summary.errors++;
        console.error("Trial reminder failed for booking", b.id, e);
      }
    }
  }

  // ---- Waitlist: email parents when a full class has a place again ----
  const { data: waitlist } = await supabase
    .from("class_waitlist")
    .select("id, class_id, parent_id")
    .is("notified_at", null);

  if ((waitlist ?? []).length > 0) {
    const classIds = [...new Set((waitlist ?? []).map((w) => w.class_id))];
    const [{ data: classes }, { data: standing }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, capacity, day_of_week, start_time, end_time, class_type, is_active, venues:venue_id ( name )")
        .in("id", classIds),
      supabase
        .from("bookings")
        .select("class_id")
        .in("class_id", classIds)
        .eq("status", "confirmed")
        .in("booking_type", ["monthly", "term", "yearly"]),
    ]);

    const enrolled = new Map<string, number>();
    for (const b of standing ?? []) {
      enrolled.set(b.class_id, (enrolled.get(b.class_id) ?? 0) + 1);
    }
    const classById = new Map((classes ?? []).map((c: any) => [c.id, c]));

    for (const entry of waitlist ?? []) {
      const cls: any = classById.get(entry.class_id);
      if (!cls || !cls.is_active) continue;
      const spaces = (cls.capacity ?? 0) - (enrolled.get(entry.class_id) ?? 0);
      if (spaces <= 0) continue;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", entry.parent_id)
          .maybeSingle();
        if (!profile?.email) continue;
        const { error } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "waitlist_space",
            to: profile.email,
            data: {
              parentName: profile.full_name,
              className: cls.name,
              classId: cls.id,
              dayOfWeek: cls.day_of_week ?? null,
              startTime: cls.start_time ?? null,
              endTime: cls.end_time ?? null,
              venueName: cls.venues?.name ?? null,
              classType: cls.class_type ?? null,
            },
          },
        });
        if (error) throw error;
        await supabase
          .from("class_waitlist")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", entry.id);
        summary.waitlistNotified++;
      } catch (e) {
        summary.errors++;
        console.error("Waitlist notification failed for entry", entry.id, e);
      }
    }
  }

  // ---- Birthdays: wish every dancer a happy birthday on the day ----
  const [todayYear, todayMonth, todayDay] = todayLondon.split("-").map(Number);
  const { data: allDancers } = await supabase
    .from("students")
    .select("id, parent_id, first_name, last_name, preferred_name, date_of_birth, is_self")
    .not("date_of_birth", "is", null);
  const birthdayDancers = (allDancers ?? []).filter((s: any) => {
    const [, m, d] = String(s.date_of_birth).split("-").map(Number);
    return m === todayMonth && d === todayDay;
  });

  if (birthdayDancers.length > 0) {
    // Only real customers — the dancer needs at least one confirmed booking.
    const { data: confirmed } = await supabase
      .from("bookings")
      .select("student_id")
      .in("student_id", birthdayDancers.map((s: any) => s.id))
      .eq("status", "confirmed");
    const bookedIds = new Set((confirmed ?? []).map((b: any) => b.student_id));

    for (const dancer of birthdayDancers) {
      if (!bookedIds.has(dancer.id)) continue;
      try {
        // Claim this year's send first — a re-run can never double-send.
        const { data: claim, error: claimErr } = await supabase
          .from("birthday_emails")
          .upsert(
            { student_id: dancer.id, year: todayYear },
            { onConflict: "student_id,year", ignoreDuplicates: true },
          )
          .select("student_id");
        if (claimErr) throw claimErr;
        if (!claim || claim.length === 0) continue; // already sent this year

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", dancer.parent_id)
          .maybeSingle();
        if (!profile?.email) continue;

        const birthYear = Number(String(dancer.date_of_birth).slice(0, 4));
        const { error } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "birthday",
            to: profile.email,
            data: {
              childName: dancer.preferred_name || dancer.first_name,
              parentName: profile.full_name,
              age: Number.isFinite(birthYear) ? todayYear - birthYear : null,
              ...(dancer.is_self && {
                audience: "adult",
                freeClassNote:
                  "Birthday treat: one adult class is on us! Claim your free " +
                  "class from the Adult Classes page — the offer is open from a " +
                  "week before your birthday to 10 days after.",
              }),
            },
          },
        });
        if (error) {
          // Release the claim so tomorrow's retry (still their birthday-year)
          // can send — a missed greeting is worse than a repeated attempt.
          await supabase
            .from("birthday_emails")
            .delete()
            .eq("student_id", dancer.id)
            .eq("year", todayYear);
          throw error;
        }
        summary.birthdayEmails++;
      } catch (e) {
        summary.errors++;
        console.error("Birthday email failed for student", dancer.id, e);
      }
    }
  }

  console.log("daily-reminders:", JSON.stringify(summary));
  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
