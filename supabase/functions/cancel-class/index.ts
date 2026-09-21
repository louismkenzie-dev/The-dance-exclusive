// Take a whole class down, keep the record of who was on it, and settle up.
//
//   POST { classId, preview: true }
//   POST { classId, message, notify?, refunds?: { [parentId]: { method, amount } } }
//
// With preview: true nothing changes; the response says who is on the class,
// what each family paid, what they're owed for the classes that won't now
// happen, and how that money can get back to them.
//
// On commit, for every family:
//   - monthly memberships on the class are ENDED NOW in Stripe (just this
//     class's item when the family has several on one subscription, the
//     whole subscription when it's the last) and marked cancelled here, so
//     nobody keeps paying for a class that isn't running.
//   - the family is settled the way Amie chose: back to the card that paid
//     (a pro-rata Stripe refund against the right payment — a booking's own
//     card payment, or the membership's latest paid invoice), or as studio
//     credit (a one-time TDE- code restricted to their email), or nothing.
//     Pass credits go straight back onto the pass either way.
//   - every place still to come is marked cancelled AND KEPT. Places on nights
//     that already happened stay confirmed so the old registers still read.
//   - sessions from today are cancelled; unspent payment links withdrawn;
//     the class retired rather than deleted.
//   - the family is emailed Amie's message once, with what was refunded or
//     the credit code, and every send lands in email_log.
//
// Money steps are per family and never abort the cancellation: a refund
// Stripe won't make is reported against that family so Amie can do it from
// Bookings → Refund, and the class still comes down. Nothing is refunded
// twice: a booking whose notes already carry a "refunded £" marker is left
// alone, a membership already cancelled isn't in the list, and a credit
// already issued for this class and email is reused, not reissued.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { connectRequestOptions, createStripeClient, type StripeEnv } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";
import {
  allocateRefund,
  alreadyRefunded,
  bookingCoverage,
  creditCode,
  passRef,
  paymentRef,
  periodCoverage,
  proRata,
  round2,
  toPence,
  type RefundRoute,
} from "../_shared/classRefunds.ts";

const APP_URL = "https://app.thedanceexclusive.co.uk";
const CREDIT_MONTHS = 6;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Method = "card" | "credit" | "none";

interface Line {
  id: string;
  kind: "booking" | "membership";
  plan: string;
  student: string | null;
  paid: number;
  total: number;
  left: number;
  suggested: number;
  /** How the money can travel: a card payment we can refund, a pass, or nothing. */
  via: "card" | "pass" | "none";
  note?: string;
}

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  students: string[];
  bookingIds: string[];
  paid: number;
  owed: number;
  canCard: boolean;
  suggestedMethod: Method;
  lines: Line[];
  /** Set on commit. */
  refund?: { method: Method; amount: number; ok: boolean; detail: string };
  credit?: { code: string; amount: number; expires: string };
  emailed?: boolean;
  reason?: string;
}

const londonDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const money = (n: number) => `£${n.toFixed(2)}`;

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
    const choices: Record<string, { method?: string; amount?: unknown }> =
      body?.refunds && typeof body.refunds === "object" ? body.refunds : {};
    if (!classId) return jsonResponse({ error: "Which class?" }, 400);

    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, class_type, term_end, is_active, venues:venue_id ( name )")
      .eq("id", classId)
      .maybeSingle();
    if (!cls) return jsonResponse({ error: "That class no longer exists" }, 404);

    const today = londonDate(new Date());

    // ── The class's calendar ───────────────────────────────────────────────
    const { data: sessionRows } = await supabase
      .from("class_sessions")
      .select("session_date, status")
      .eq("class_id", classId);
    const sessionDates = ((sessionRows ?? []) as { session_date: string; status: string }[])
      .filter((s) => s.status !== "cancelled")
      .map((s) => s.session_date)
      .sort();
    const futureSessions = sessionDates.filter((d) => d >= today).length;

    // ── Who is on it ───────────────────────────────────────────────────────
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("id, parent_id, student_id, booking_type, amount, status, notes, booked_at, students:student_id ( first_name, last_name )")
      .eq("class_id", classId)
      .neq("status", "cancelled");
    const allBookings = (bookingRows ?? []) as any[];

    // A place on a night that has already happened is left exactly as it is.
    // That child came, the register has them on it, and Amie can still open
    // that week months later. Only what is still to come is cancelled:
    // standing places, and dated ones from today onwards.
    const dateOf = (b: any) => /session (\d{4}-\d{2}-\d{2})/.exec(b.notes ?? "")?.[1] ?? null;
    const bookings = allBookings.filter((b) => (dateOf(b) ?? today) >= today);
    const pastBookings = allBookings.length - bookings.length;

    const { data: memRows } = await supabase
      .from("memberships")
      .select("id, user_id, student_id, status, monthly_amount, stripe_env, stripe_subscription_id, stripe_subscription_item_id, students:student_id ( first_name, last_name )")
      .eq("class_id", classId)
      .in("status", ["active", "past_due", "paused", "cancel_scheduled"]);
    const memberships = (memRows ?? []) as any[];

    const { data: inviteRows } = await supabase
      .from("class_invites")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "pending");
    const pendingInvites = (inviteRows ?? []) as { id: string }[];

    const parentIds = [...new Set([
      ...bookings.map((b) => b.parent_id),
      ...memberships.map((m) => m.user_id),
    ].filter(Boolean))];
    const { data: profiles } = parentIds.length
      ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds)
      : { data: [] as any[] };
    const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));

    // ── Stripe, only as far as we need it ──────────────────────────────────
    const activeEnv = await getActiveStripeEnv(supabase);
    const stripeFor = (() => {
      const cache = new Map<StripeEnv, ReturnType<typeof createStripeClient>>();
      return (env: StripeEnv) => {
        if (!cache.has(env)) cache.set(env, createStripeClient(env));
        return cache.get(env)!;
      };
    })();

    const studentName = (row: any) =>
      row?.students ? `${row.students.first_name} ${row.students.last_name}` : null;

    const families = new Map<string, Family>();
    const familyFor = (parentId: string): Family => {
      let f = families.get(parentId);
      if (!f) {
        f = {
          parentId,
          parentName: profileById.get(parentId)?.full_name ?? null,
          email: profileById.get(parentId)?.email ?? null,
          students: [],
          bookingIds: [],
          paid: 0,
          owed: 0,
          canCard: false,
          suggestedMethod: "none",
          lines: [],
        };
        families.set(parentId, f);
      }
      return f;
    };
    const addStudent = (f: Family, name: string | null) => {
      if (name && !f.students.includes(name)) f.students.push(name);
    };

    // Where each refund could go, and how much each payment still has on it.
    const routes = new Map<string, RefundRoute[]>(); // parentId → routes
    const remainingByPi = new Map<string, number>();
    const lookupRemaining = async (env: StripeEnv, pi: string): Promise<number> => {
      if (remainingByPi.has(pi)) return remainingByPi.get(pi)!;
      try {
        const intent: any = await stripeFor(env).paymentIntents.retrieve(
          pi, { expand: ["latest_charge"] }, connectRequestOptions(env),
        );
        const charge = intent?.latest_charge;
        const left = intent?.status === "succeeded"
          ? Math.max(0, (charge?.amount ?? 0) - (charge?.amount_refunded ?? 0))
          : 0;
        remainingByPi.set(pi, left);
        return left;
      } catch (e) {
        console.error("cancel-class: payment lookup failed", pi, e instanceof Error ? e.message : e);
        remainingByPi.set(pi, 0);
        return 0;
      }
    };

    // ── Bookings: what each place cost and what's left of it ───────────────
    const monthlyBookingByKey = new Map<string, any>(); // `${parent}|${student}` → shadow booking
    for (const b of bookings) {
      const f = familyFor(b.parent_id);
      addStudent(f, studentName(b));
      f.bookingIds.push(b.id);
      const paid = round2(Number(b.amount ?? 0));

      // A monthly booking is the shadow of a membership; the money lives on
      // the subscription and is settled under the membership below.
      if (b.booking_type === "monthly") {
        monthlyBookingByKey.set(`${b.parent_id}|${b.student_id ?? ""}`, b);
        continue;
      }
      f.paid = round2(f.paid + paid);

      const cov = bookingCoverage(
        b.booking_type, b.notes, String(b.booked_at ?? "").slice(0, 10), (cls as any).term_end, sessionDates, today,
      );
      const pass = passRef(b.notes);
      const pi = paymentRef(b.notes);
      const line: Line = {
        id: b.id, kind: "booking", plan: b.booking_type, student: studentName(b),
        paid, total: cov.total, left: cov.left, suggested: 0, via: "none",
      };
      if (pass) {
        line.via = "pass";
        line.note = cov.left > 0 ? "Class goes back on their pass" : "Already taken";
      } else if (alreadyRefunded(b.notes)) {
        line.note = "Already refunded";
      } else if (paid > 0 && cov.left > 0) {
        line.suggested = proRata(paid, cov);
        if (pi) {
          const left = await lookupRemaining(activeEnv, pi);
          if (left > 0) {
            line.via = "card";
            const rs = routes.get(b.parent_id) ?? [];
            rs.push({ id: b.id, paymentIntentId: pi, maxPence: toPence(line.suggested) });
            routes.set(b.parent_id, rs);
          } else {
            line.note = "Card payment already refunded in full";
          }
        } else {
          line.note = "No card payment on record (added by hand or paid another way)";
        }
      }
      f.lines.push(line);
    }

    // ── Memberships: this month's share, off the latest paid invoice ───────
    interface MemPlan {
      m: any;
      env: StripeEnv;
      sub: any | null;
      invoicePi: string | null;
      linePaid: number;
    }
    const memPlans: MemPlan[] = [];
    for (const m of memberships) {
      const f = familyFor(m.user_id);
      addStudent(f, studentName(m));
      const env: StripeEnv = m.stripe_env === "live" ? "live" : "sandbox";
      const plan: MemPlan = { m, env, sub: null, invoicePi: null, linePaid: 0 };
      memPlans.push(plan);

      const line: Line = {
        id: m.id, kind: "membership", plan: "monthly", student: studentName(m),
        paid: round2(Number(m.monthly_amount ?? 0)), total: 0, left: 0, suggested: 0, via: "none",
      };
      try {
        const stripe = stripeFor(env);
        const opts = connectRequestOptions(env);
        plan.sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, opts);
        const sub: any = plan.sub;
        const periodStart = sub?.current_period_start ? londonDate(new Date(sub.current_period_start * 1000)) : null;
        const periodEnd = sub?.current_period_end ? londonDate(new Date(sub.current_period_end * 1000)) : null;
        if (periodStart && periodEnd) {
          const cov = periodCoverage(sessionDates, periodStart, periodEnd, today);
          line.total = cov.total;
          line.left = cov.left;

          if (m.status === "paused") {
            line.note = "Free month — nothing paid for this period";
          } else if (cov.left > 0 && line.paid > 0) {
            // The month's money: this item's line on the newest paid invoice.
            const { data: invoices } = await stripe.invoices.list(
              { subscription: m.stripe_subscription_id, status: "paid", limit: 3 }, opts,
            );
            const inv: any = (invoices ?? [])
              .filter((i: any) => i.amount_paid > 0)
              .sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0))[0];
            const invLine: any = inv?.lines?.data?.find((l: any) =>
              (l.subscription_item ?? l.parent?.subscription_item_details?.subscription_item) === m.stripe_subscription_item_id
            );
            plan.linePaid = round2((invLine?.amount ?? 0) / 100) || line.paid;
            plan.invoicePi = typeof inv?.payment_intent === "string" ? inv.payment_intent : inv?.payment_intent?.id ?? null;
            line.paid = plan.linePaid;
            line.suggested = proRata(plan.linePaid, cov);
            if (plan.invoicePi) {
              const left = await lookupRemaining(env, plan.invoicePi);
              if (left > 0) {
                line.via = "card";
                const rs = routes.get(m.user_id) ?? [];
                rs.push({ id: m.id, paymentIntentId: plan.invoicePi, maxPence: toPence(line.suggested) });
                routes.set(m.user_id, rs);
              } else {
                line.note = "This month's payment is already refunded in full";
              }
            } else {
              line.note = "No paid invoice found for this month";
            }
          } else if (cov.left === 0) {
            line.note = "Every class in this billing period has already run";
          }
        } else {
          line.note = "Couldn't read the billing period from Stripe";
        }
      } catch (e) {
        console.error("cancel-class: membership lookup failed", m.id, e instanceof Error ? e.message : e);
        line.note = "Couldn't reach this subscription in Stripe";
      }
      f.paid = round2(f.paid + line.paid);
      f.lines.push(line);
    }

    for (const f of families.values()) {
      f.owed = round2(f.lines.reduce((s, l) => s + l.suggested, 0));
      f.canCard = f.lines.some((l) => l.via === "card");
      // A credit code is locked to an email address, so a family with neither a
      // card payment nor an email can only be settled by hand.
      f.suggestedMethod = f.owed <= 0 ? "none" : f.canCard ? "card" : f.email ? "credit" : "none";
    }

    const familyList = [...families.values()].sort((a, b) =>
      (a.parentName ?? "").localeCompare(b.parentName ?? "")
    );
    const summary = {
      className: cls.name as string,
      venueName: (cls as any).venues?.name ?? null,
      families: familyList,
      bookingCount: bookings.length,
      pastBookings,
      pendingInvites: pendingInvites.length,
      futureSessions,
      totalPaid: round2(familyList.reduce((s, f) => s + f.paid, 0)),
      totalOwed: round2(familyList.reduce((s, f) => s + f.owed, 0)),
      memberships: memberships.length,
    };

    if (preview) return jsonResponse({ preview: true, ...summary });

    if (notify && !message) {
      return jsonResponse({ error: "Write the message the parents will receive" }, 400);
    }

    const notesById = new Map<string, string | null>(bookings.map((b) => [b.id, b.notes ?? null]));
    const appendNote = (id: string, note: string) => {
      const cur = notesById.get(id);
      notesById.set(id, cur ? `${cur} | ${note}` : note);
    };
    const nowIso = new Date().toISOString();

    // ── End the memberships, whatever the refund choice ────────────────────
    for (const p of memPlans) {
      const m = p.m;
      try {
        const stripe = stripeFor(p.env);
        const opts = connectRequestOptions(p.env);
        const sub: any = p.sub ?? await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, opts).catch(() => null);
        if (sub && sub.status !== "canceled") {
          const items: any[] = sub.items?.data ?? [];
          if (m.stripe_subscription_item_id && items.length > 1 && items.some((i) => i.id === m.stripe_subscription_item_id)) {
            await stripe.subscriptionItems.del(m.stripe_subscription_item_id, { proration_behavior: "none" }, opts);
          } else {
            await stripe.subscriptions.cancel(m.stripe_subscription_id, { prorate: false, invoice_now: false } as any, opts);
          }
        }
        await supabase
          .from("memberships")
          .update({ status: "cancelled", cancelled_at: nowIso, cancel_at: null, updated_at: nowIso })
          .eq("id", m.id);
        const shadow = monthlyBookingByKey.get(`${m.user_id}|${m.student_id ?? ""}`);
        if (shadow) appendNote(shadow.id, `membership ended ${today}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("cancel-class: could not end membership", m.id, msg);
        const f = familyFor(m.user_id);
        f.refund = { method: "none", amount: 0, ok: false, detail: `Membership couldn't be ended in Stripe: ${msg}` };
      }
    }

    // ── Settle up, family by family ────────────────────────────────────────
    const expires = new Date();
    expires.setMonth(expires.getMonth() + CREDIT_MONTHS);
    expires.setHours(23, 59, 59, 999);

    for (const f of familyList) {
      // Pass credits go back regardless — they're the family's, not money.
      for (const l of f.lines) {
        if (l.kind !== "booking" || l.via !== "pass" || l.left === 0) continue;
        const b = bookings.find((x) => x.id === l.id);
        const passId = passRef(b?.notes);
        if (!passId) continue;
        const { error } = await supabase.rpc("refund_pass_credits", { p_pass_id: passId, p_amount: 1 });
        if (error) console.error("cancel-class: pass credit not returned", passId, error.message);
        else appendNote(l.id, `class returned to pass ${today}`);
      }

      if (f.refund && !f.refund.ok) continue; // membership failed to end — leave the money for a human

      const choice = choices[f.parentId] ?? {};
      const method: Method = choice.method === "card" || choice.method === "credit" || choice.method === "none"
        ? choice.method
        : f.suggestedMethod;
      const requested = typeof choice.amount === "number" && Number.isFinite(choice.amount)
        ? round2(Math.max(0, choice.amount))
        : f.owed;

      if (method === "none" || requested <= 0) {
        f.refund = { method: "none", amount: 0, ok: true, detail: requested > 0 ? "Not refunded, by choice" : "Nothing owed" };
        continue;
      }

      if (method === "card") {
        // Card refunds can't exceed what was paid for the class, however the
        // amount was edited: the cap is the pro-rata on each payment.
        const { plan, unplacedPence } = allocateRefund(toPence(requested), routes.get(f.parentId) ?? [], remainingByPi);
        let refunded = 0;
        const failures: string[] = [];
        for (const step of plan) {
          try {
            const isMembership = memPlans.some((p) => p.m.id === step.id);
            const env = isMembership ? memPlans.find((p) => p.m.id === step.id)!.env : activeEnv;
            const refund: any = await stripeFor(env).refunds.create(
              {
                payment_intent: step.paymentIntentId,
                amount: step.pence,
                metadata: {
                  classId, parentId: f.parentId, adminUserId: user.id,
                  [isMembership ? "membershipId" : "bookingId"]: step.id,
                  reason: `${cls.name} cancelled`,
                },
              },
              connectRequestOptions(env),
            );
            remainingByPi.set(step.paymentIntentId, (remainingByPi.get(step.paymentIntentId) ?? 0) - step.pence);
            refunded += step.pence;
            const marker = `refunded ${money(step.pence / 100)} on ${today} (${refund.id})`;
            if (isMembership) {
              const p = memPlans.find((x) => x.m.id === step.id)!;
              const shadow = monthlyBookingByKey.get(`${p.m.user_id}|${p.m.student_id ?? ""}`);
              if (shadow) appendNote(shadow.id, marker);
            } else {
              appendNote(step.id, marker);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("cancel-class: refund failed", step, msg);
            failures.push(msg);
          }
        }
        const pounds = round2(refunded / 100);
        const short = round2(requested - pounds);
        f.refund = {
          method: "card",
          amount: pounds,
          ok: failures.length === 0 && refunded > 0,
          detail: failures.length
            ? `Stripe refused: ${failures[0]}`
            : unplacedPence > 0 || short > 0
              ? `${money(pounds)} sent back to their card; ${money(short)} couldn't be placed on a payment — refund it from Bookings or issue credit`
              : `${money(pounds)} sent back to their card`,
        };
        continue;
      }

      // Studio credit: a one-time code for their email, reused if this class
      // has already issued one to them (a retry must not double it).
      try {
        if (!f.email) throw new Error("no email address to lock the code to");
        const tag = `[class-cancelled:${classId}]`;
        let code: string | null = null;
        const { data: existing } = await supabase
          .from("coupons")
          .select("code, discount_value")
          .eq("restricted_to_email", f.email)
          .ilike("description", `%${tag}%`)
          .limit(1);
        if (existing?.[0]) {
          code = existing[0].code;
          f.credit = { code: code!, amount: Number(existing[0].discount_value), expires: expires.toISOString() };
        }
        if (!code) {
          for (let attempt = 0; attempt < 5 && !code; attempt++) {
            const candidate = creditCode();
            const { data: clash } = await supabase.from("coupons").select("id").eq("code", candidate).maybeSingle();
            if (!clash) code = candidate;
          }
          if (!code) throw new Error("couldn't find an unused code");
          const { error } = await supabase.from("coupons").insert({
            code,
            description: `Credit for ${cls.name} — class cancelled ${today} ${tag}`,
            discount_type: "fixed",
            discount_value: requested,
            valid_from: null,
            valid_until: expires.toISOString(),
            usage_limit_total: 1,
            usage_limit_per_user: 1,
            is_active: true,
            applies_to_kinds: ["camp", "class", "monthly", "pass"],
            restricted_to_email: f.email,
            applies_to_class_types: [],
            applies_to_pricing_plans: [],
            applies_to_class_ids: [],
            applies_to_camp_ids: [],
            created_by: user.id,
          });
          if (error) throw new Error(error.message);
          f.credit = { code, amount: requested, expires: expires.toISOString() };
          for (const id of f.bookingIds) appendNote(id, `credit ${money(requested)} issued ${today} (${code})`);
        }
        f.refund = { method: "credit", amount: f.credit!.amount, ok: true, detail: `${money(f.credit!.amount)} studio credit, code ${f.credit!.code}` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("cancel-class: credit failed", f.parentId, msg);
        f.refund = { method: "credit", amount: 0, ok: false, detail: `Credit couldn't be issued: ${msg}` };
      }
    }

    // ── Cancel the places, and keep them ───────────────────────────────────
    const stamp = `cancelled ${today}: ${cls.name} is no longer running`;
    let cancelledBookings = 0;
    for (const b of bookings) {
      appendNote(b.id, stamp);
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled", notes: notesById.get(b.id) })
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
      for (const f of familyList) {
        if (!f.email) { f.emailed = false; f.reason = "No email address on file"; continue; }
        const refunded = f.refund?.method === "card" && f.refund.ok ? f.refund.amount : null;
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
              refundedAmount: refunded,
              creditCode: f.credit?.code ?? null,
              creditAmount: f.credit?.amount ?? null,
              creditExpires: f.credit?.expires ?? null,
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

    const refundedTotal = round2(familyList.reduce((s, f) => s + (f.refund?.method === "card" && f.refund.ok ? f.refund.amount : 0), 0));
    const creditTotal = round2(familyList.reduce((s, f) => s + (f.credit?.amount ?? 0), 0));
    console.log("cancel-class:", JSON.stringify({
      by: user.id, classId, className: cls.name,
      cancelledBookings, keptPast: pastBookings, sessions: killedSessions?.length ?? 0,
      memberships: memPlans.length, invites: pendingInvites.length,
      refundedTotal, creditTotal, emailed,
    }));

    return jsonResponse({
      ok: true,
      className: cls.name,
      cancelledBookings,
      keptPastBookings: pastBookings,
      withdrawnInvites: pendingInvites.length,
      cancelledSessions: killedSessions?.length ?? 0,
      endedMemberships: memPlans.length,
      refundedTotal,
      creditTotal,
      emailed,
      families: familyList,
      totalPaid: summary.totalPaid,
    });
  } catch (e) {
    console.error("cancel-class error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
