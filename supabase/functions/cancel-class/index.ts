// Take a whole class down, and keep the record of who was on it.
//
//   POST { classId, preview?: boolean, message?: string, notify?: boolean }
//
// With preview: true nothing changes; the response says who is on the class,
// what it would cost to refund, and whether anything is in the way.
//
// On commit:
//   - every booking on the class is marked 'cancelled' AND KEPT. This is the
//     whole point. Amie cancelled the Elmstead Primary School classes by
//     refunding everyone and then deleting the class; bookings.class_id
//     cascades, so the parents' names, emails and phone numbers went with it
//     and she had nobody left to tell. A cancelled booking is still a record
//     of a family who was here.
//     Places for nights that have already happened are left confirmed, so the
//     historic registers still show who was there.
//   - sessions still to come are marked 'cancelled', so no register expects
//     anyone; sessions that already happened are left exactly as they were.
//   - unspent payment links for the class are withdrawn, so nobody can still
//     pay for it through a link Amie sent last week.
//   - the class is retired (is_active = false, booking_enabled = false)
//     rather than deleted, so it stops being sold but stays readable.
//   - with notify: true each family is emailed the studio's message once,
//     however many of their children were on the class, and every send is
//     written to email_log so "have they been told?" is answerable later.
//
// It refuses while live memberships remain. Those are Stripe subscriptions:
// retiring the class underneath one leaves a family paying every month for
// something that is not running. End them properly first.
//
// It takes no money and gives none back. Refunds stay a human decision, made
// in Stripe, by a person who has looked at the amounts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_URL = "https://app.thedanceexclusive.co.uk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  students: string[];
  bookingIds: string[];
  paid: number;
  /** Set on commit. */
  emailed?: boolean;
  reason?: string;
}

const todayLondon = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return jsonResponse({ error: "Only admins can cancel a class" }, 403);

    const body = await req.json().catch(() => ({}));
    const classId: string | undefined = body?.classId;
    const preview = body?.preview === true;
    const notify = body?.notify !== false; // default on — telling people is the point
    const message: string = typeof body?.message === "string" ? body.message.trim() : "";
    if (!classId) return jsonResponse({ error: "Which class?" }, 400);

    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, class_type, day_of_week, start_time, is_active, venues:venue_id ( name )")
      .eq("id", classId)
      .maybeSingle();
    if (!cls) return jsonResponse({ error: "That class no longer exists" }, 404);

    const today = todayLondon();

    // ── Who is on it ───────────────────────────────────────────────────────
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("id, parent_id, student_id, amount, status, notes, students:student_id ( first_name, last_name )")
      .eq("class_id", classId)
      .neq("status", "cancelled");
    const allBookings = (bookingRows ?? []) as any[];

    // A place on a night that has already happened is left exactly as it is.
    // That child came, the register has them on it, and Amie can still open
    // that week months later. Cancelling it would quietly empty the history.
    // So only what is still to come is cancelled: standing places, and dated
    // ones from today onwards.
    const bookedDate = (b: { notes?: string | null }) =>
      /session (\d{4}-\d{2}-\d{2})/.exec(b.notes ?? "")?.[1] ?? null;
    const bookings = allBookings.filter((b) => (bookedDate(b) ?? today) >= today);
    const pastBookings = allBookings.length - bookings.length;

    // Live memberships are Stripe subscriptions. They must be ended through
    // the membership tools, which know how to stop the billing.
    const { data: memRows } = await supabase
      .from("memberships")
      .select("id, user_id, status, monthly_amount, students:student_id ( first_name, last_name )")
      .eq("class_id", classId)
      .neq("status", "cancelled");
    const liveMemberships = (memRows ?? []) as any[];

    // Unspent payment links. create-payment-intent treats a pending invite as
    // authority to sell a class it would otherwise refuse, so a link left
    // alive here would still take money for a class that isn't running.
    const { data: inviteRows } = await supabase
      .from("class_invites")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "pending");
    const pendingInvites = (inviteRows ?? []) as { id: string }[];

    const parentIds = [...new Set(bookings.map((b) => b.parent_id).filter(Boolean))];
    const { data: profiles } = parentIds.length
      ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds)
      : { data: [] as any[] };
    const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));

    const families = new Map<string, Family>();
    for (const b of bookings) {
      const f = families.get(b.parent_id) ?? {
        parentId: b.parent_id,
        parentName: profileById.get(b.parent_id)?.full_name ?? null,
        email: profileById.get(b.parent_id)?.email ?? null,
        students: [],
        bookingIds: [],
        paid: 0,
      };
      const name = b.students ? `${b.students.first_name} ${b.students.last_name}` : null;
      if (name && !f.students.includes(name)) f.students.push(name);
      f.bookingIds.push(b.id);
      f.paid = Math.round((f.paid + Number(b.amount ?? 0)) * 100) / 100;
      families.set(b.parent_id, f);
    }

    const { count: futureSessions } = await supabase
      .from("class_sessions")
      .select("*", { count: "exact", head: true })
      .eq("class_id", classId)
      .gte("session_date", today)
      .neq("status", "cancelled");

    const summary = {
      className: cls.name as string,
      venueName: (cls as any).venues?.name ?? null,
      families: [...families.values()],
      bookingCount: bookings.length,
      pastBookings,
      pendingInvites: pendingInvites.length,
      futureSessions: futureSessions ?? 0,
      totalPaid: Math.round([...families.values()].reduce((s, f) => s + f.paid, 0) * 100) / 100,
      liveMemberships: liveMemberships.map((m) => ({
        id: m.id,
        status: m.status,
        monthlyAmount: Number(m.monthly_amount ?? 0),
        studentName: m.students ? `${m.students.first_name} ${m.students.last_name}` : null,
      })),
    };

    if (preview) return jsonResponse({ preview: true, ...summary });

    if (liveMemberships.length > 0) {
      return jsonResponse({
        error:
          `${liveMemberships.length} membership(s) are still live on ${cls.name}. ` +
          `Those are monthly subscriptions — end them from Memberships & Plans first, ` +
          `otherwise these families keep paying for a class that isn't running.`,
        liveMemberships: summary.liveMemberships,
      }, 409);
    }
    if (notify && !message) {
      return jsonResponse({ error: "Write the message the parents will receive" }, 400);
    }

    // ── Cancel the places, and keep them ───────────────────────────────────
    const stamp = `cancelled ${today}: ${cls.name} is no longer running`;
    let cancelledBookings = 0;
    for (const b of bookings) {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          notes: b.notes ? `${b.notes} | ${stamp}` : stamp,
        })
        .eq("id", b.id)
        .neq("status", "cancelled");
      if (error) console.error("cancel-class: booking update failed", b.id, error.message);
      else cancelledBookings++;
    }

    // Sessions still to come. What already happened, happened.
    const { data: killedSessions } = await supabase
      .from("class_sessions")
      .update({ status: "cancelled" })
      .eq("class_id", classId)
      .gte("session_date", today)
      .neq("status", "cancelled")
      .select("id");

    if (pendingInvites.length > 0) {
      const { error: invErr } = await supabase
        .from("class_invites")
        .update({ status: "cancelled" })
        .eq("class_id", classId)
        .eq("status", "pending");
      if (invErr) console.error("cancel-class: invites not withdrawn", invErr.message);
    }

    // Retire, don't delete. The delete would take all of the above with it.
    const { error: clsErr } = await supabase
      .from("classes")
      .update({ is_active: false, booking_enabled: false })
      .eq("id", classId);
    if (clsErr) console.error("cancel-class: retire failed", clsErr.message);

    // ── Tell the families ──────────────────────────────────────────────────
    let emailed = 0;
    if (notify) {
      for (const f of families.values()) {
        if (!f.email) { f.emailed = false; f.reason = "No email address on file"; continue; }
        const { error } = await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: {
            template: "class_cancelled",
            to: f.email,
            data: {
              parentName: f.parentName,
              className: cls.name,
              venueName: (cls as any).venues?.name ?? null,
              classType: (cls as any).class_type ?? null,
              message,
              refundedAmount: null, // refunds are made in Stripe, by a person
              browseUrl: `${APP_URL}/classes/${(cls as any).class_type === "adult" ? "adult" : "children"}`,
            },
            meta: {
              parentId: f.parentId,
              classId,
              bookingId: f.bookingIds[0] ?? null,
              sentBy: user.id,
              source: "manual",
            },
          },
        });
        if (error) {
          console.error("cancel-class: email failed for", f.email, error);
          f.emailed = false;
          f.reason = "Email failed to send";
        } else {
          f.emailed = true;
          emailed++;
        }
      }
    }

    console.log("cancel-class:", JSON.stringify({
      by: user.id, classId, className: cls.name,
      cancelledBookings, sessions: killedSessions?.length ?? 0,
      invites: pendingInvites.length, emailed,
    }));

    return jsonResponse({
      ok: true,
      className: cls.name,
      cancelledBookings,
      keptPastBookings: pastBookings,
      withdrawnInvites: pendingInvites.length,
      cancelledSessions: killedSessions?.length ?? 0,
      emailed,
      families: [...families.values()],
      totalPaid: summary.totalPaid,
    });
  } catch (e) {
    console.error("cancel-class error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
