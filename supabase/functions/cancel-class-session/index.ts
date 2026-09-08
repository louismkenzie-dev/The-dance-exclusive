// Cancel one class session — the emergency button for a power cut, a
// closed venue or an ill teacher. Admin only.
//
//   POST { sessionId, preview?: boolean, targetSessionId?: string | null,
//          notify?: boolean, reason?: string }
//
// With preview: true nothing changes; the response describes who is booked
// and what would happen to each of them, so the admin can confirm.
//
// On commit:
//   - the session is marked 'cancelled' (the reason goes on its notes);
//   - every DATED booking on that date (a trial, a pay-as-you-go session,
//     a pass redemption) moves to the target session — by default the
//     class's next scheduled date — at no charge; the reminder stamp is
//     cleared so the new date gets its own reminder;
//   - STANDING bookings (monthly, termly, yearly) are left alone: the place
//     carries on next week and nothing about billing changes;
//   - a dated booking that can't move (no later date, or the family already
//     holds that date) is left where it is and reported, never refunded or
//     cancelled automatically — money is a human decision;
//   - with notify: true every affected family is emailed what it means for
//     each of their dancers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DATE_MARKER = /session (\d{4}-\d{2}-\d{2})/;
const STANDING_TYPES = new Set(["monthly", "termly", "yearly", "annual"]);

type Outcome = "moved" | "carries_on" | "unmoved";

interface Line {
  bookingId: string;
  studentId: string | null;
  studentName: string | null;
  bookingType: string;
  outcome: Outcome;
  /** Why an unmoved booking stays put. */
  note?: string;
}

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  lines: Line[];
}

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
    if (!adminRole) return jsonResponse({ error: "Only admins can cancel a session" }, 403);

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    const preview = body?.preview === true;
    const notify = body?.notify !== false; // default: tell the families
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    const requestedTarget = typeof body?.targetSessionId === "string" ? body.targetSessionId : null;
    if (!sessionId) return jsonResponse({ error: "Which session?" }, 400);

    // ── The session ──────────────────────────────────────────────────────
    const { data: session } = await supabase
      .from("class_sessions")
      .select("id, class_id, session_date, start_time, end_time, status, notes, classes:class_id ( name, venues:venue_id ( name ) )")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) return jsonResponse({ error: "Session not found" }, 404);
    if (session.status === "cancelled") return jsonResponse({ error: "This session is already cancelled" }, 409);
    const cls: any = session.classes;
    const className: string = cls?.name ?? "Class";
    const venueName: string | null = cls?.venues?.name ?? null;

    // ── Where dated bookings go: the next scheduled date, or the one chosen ──
    const { data: upcoming } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, end_time")
      .eq("class_id", session.class_id)
      .eq("status", "scheduled")
      .gt("session_date", session.session_date)
      .order("session_date", { ascending: true })
      .limit(8);
    const alternatives = (upcoming ?? []) as { id: string; session_date: string; start_time: string; end_time: string }[];
    let target = alternatives[0] ?? null;
    if (requestedTarget) {
      const chosen = alternatives.find((s) => s.id === requestedTarget);
      if (!chosen) return jsonResponse({ error: "That date isn't one of this class's upcoming sessions" }, 400);
      target = chosen;
    }

    // ── Everyone booked on the class, and what today means for them ─────
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, parent_id, student_id, booking_type, notes, students:student_id ( first_name, last_name, preferred_name )")
      .eq("class_id", session.class_id)
      .eq("status", "confirmed");

    const affected = ((bookings ?? []) as any[]).filter((b) => {
      const m = DATE_MARKER.exec(b.notes ?? "");
      return !m || m[1] === session.session_date; // standing, or dated for this day
    });

    // Dates already held by each attendee on the target day, so a move
    // never doubles them up.
    const heldOnTarget = new Set<string>();
    if (target) {
      for (const b of (bookings ?? []) as any[]) {
        const m = DATE_MARKER.exec(b.notes ?? "");
        if (m && m[1] === target.session_date) heldOnTarget.add(`${b.parent_id}|${b.student_id ?? ""}`);
      }
    }

    const parentIds = [...new Set(affected.map((b) => b.parent_id as string))];
    const { data: profiles } = parentIds.length
      ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds)
      : { data: [] as any[] };
    const profileById = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const families = new Map<string, Family>();
    for (const b of affected) {
      const st = b.students;
      const studentName = st ? `${st.preferred_name || st.first_name} ${st.last_name}` : null;
      const dated = DATE_MARKER.test(b.notes ?? "");
      let outcome: Outcome;
      let note: string | undefined;
      if (!dated || STANDING_TYPES.has(b.booking_type)) {
        outcome = "carries_on";
      } else if (!target) {
        outcome = "unmoved";
        note = "No later date to move it to";
      } else if (heldOnTarget.has(`${b.parent_id}|${b.student_id ?? ""}`)) {
        outcome = "unmoved";
        note = `Already booked on ${target.session_date}`;
      } else {
        outcome = "moved";
      }
      const p = profileById.get(b.parent_id);
      const fam = families.get(b.parent_id) ?? {
        parentId: b.parent_id,
        parentName: p?.full_name ?? null,
        email: p?.email ?? null,
        lines: [],
      };
      fam.lines.push({ bookingId: b.id, studentId: b.student_id ?? null, studentName, bookingType: b.booking_type, outcome, note });
      families.set(b.parent_id, fam);
    }

    const familyList = [...families.values()].sort((a, b) => (a.parentName ?? "").localeCompare(b.parentName ?? ""));
    const tally = () => {
      const c = { moved: 0, carries_on: 0, unmoved: 0 };
      for (const f of familyList) for (const l of f.lines) c[l.outcome]++;
      return c;
    };
    const counts = tally();

    const summary = {
      session: {
        id: session.id,
        classId: session.class_id,
        className,
        venueName,
        date: session.session_date,
        startTime: session.start_time,
        endTime: session.end_time,
      },
      target: target ? { id: target.id, date: target.session_date, startTime: target.start_time, endTime: target.end_time } : null,
      alternatives: alternatives.map((s) => ({ id: s.id, date: s.session_date, startTime: s.start_time, endTime: s.end_time })),
      families: familyList,
      counts,
    };

    if (preview) return jsonResponse({ preview: true, ...summary });

    // ── Commit ───────────────────────────────────────────────────────────
    const moveErrors: string[] = [];
    if (target) {
      for (const f of familyList) {
        for (const l of f.lines) {
          if (l.outcome !== "moved") continue;
          const b = affected.find((x) => x.id === l.bookingId);
          const newNotes = String(b?.notes ?? "")
            .replace(`session ${session.session_date}`, `session ${target.session_date}`)
            .replace(" | reminder sent", "")
            + ` | moved from ${session.session_date} (class cancelled)`;
          const { error } = await supabase.from("bookings").update({ notes: newNotes }).eq("id", l.bookingId);
          if (error) {
            moveErrors.push(`${l.studentName ?? l.bookingId}: ${error.message}`);
            l.outcome = "unmoved";
            l.note = "Could not be moved";
          }
        }
      }
    }

    const stamp = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const cancelNote = `Cancelled ${stamp}${reason ? `: ${reason}` : ""}`;
    const { error: cancelError } = await supabase
      .from("class_sessions")
      .update({ status: "cancelled", notes: session.notes ? `${session.notes}\n${cancelNote}` : cancelNote })
      .eq("id", session.id);
    if (cancelError) return jsonResponse({ error: `Could not cancel the session: ${cancelError.message}` }, 500);

    // ── Tell the families ────────────────────────────────────────────────
    let emailed = 0;
    const emailErrors: string[] = [];
    if (notify) {
      for (const f of familyList) {
        if (!f.email) continue;
        try {
          const { error } = await supabase.functions.invoke("send-email", {
            headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
            body: {
              template: "session_cancelled",
              to: f.email,
              data: {
                parentName: f.parentName,
                className,
                sessionDate: session.session_date,
                startTime: session.start_time,
                endTime: session.end_time,
                venueName,
                reason: reason || null,
                lines: f.lines.map((l) => ({
                  studentName: l.studentName,
                  bookingType: l.bookingType,
                  outcome: l.outcome,
                  toDate: l.outcome === "moved" ? target?.session_date ?? null : null,
                  toStartTime: l.outcome === "moved" ? target?.start_time ?? null : null,
                  toEndTime: l.outcome === "moved" ? target?.end_time ?? null : null,
                })),
              },
            },
          });
          if (error) throw error;
          emailed++;
        } catch (e: any) {
          emailErrors.push(`${f.parentName ?? f.email}: ${e?.message ?? "send failed"}`);
        }
      }
    }

    const finalCounts = tally();
    console.log("cancel-class-session:", JSON.stringify({
      sessionId: session.id, className, date: session.session_date, by: user.id,
      target: target?.session_date ?? null, counts: finalCounts, emailed, moveErrors, emailErrors,
    }));

    return jsonResponse({
      success: true,
      ...summary,
      counts: finalCounts,
      emailed,
      moveErrors,
      emailErrors,
    });
  } catch (error: any) {
    console.error("cancel-class-session error:", error);
    return jsonResponse({ error: error?.message ?? "Something went wrong" }, 500);
  }
});
