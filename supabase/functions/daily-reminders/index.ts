// Daily reminder emails (invoked by pg_cron each morning, ~9am UK time):
// 1. every trial booking whose chosen session is TOMORROW gets a friendly
//    reminder email, including the studio-written note stored in
//    app_settings.trial_reminder_message (editable by admins).
//    Idempotent: each booking is stamped "reminder sent" in its notes.
// 2. waitlist check: any class with un-notified waitlist entries and a free
//    standing place (confirmed monthly/term/yearly bookings < capacity)
//    triggers a "space has opened up" email; entries are stamped notified_at
//    so each parent is emailed once per opening (they re-join to hear again).
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

  const summary = { date: tomorrow, trialReminders: 0, waitlistNotified: 0, errors: 0 };

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, parent_id, notes,
       students:student_id ( first_name, last_name, preferred_name ),
       classes:class_id ( name, start_time, end_time, venues:venue_id ( name ) )`,
    )
    .eq("status", "confirmed")
    .eq("booking_type", "trial")
    .ilike("notes", `%session ${tomorrow}%`)
    .not("notes", "ilike", "%reminder sent%");

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

  console.log("daily-reminders:", JSON.stringify(summary));
  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
