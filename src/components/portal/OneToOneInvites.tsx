import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { classLinkPath } from "@/lib/classLinks";
import { inviteAlreadyHeld } from "@/lib/inviteMatching";
import { formatPrice, formatTimeRange } from "@/lib/bookingFormat";

interface PortalInvite {
  id: string;
  class_id: string;
  student_id: string;
  price: number;
  /** trial | session | term | yearly | monthly — set when an admin books it. */
  plan: string;
  /** Dates the admin picked for a dated plan. */
  session_dates: string[] | null;
  classes: {
    name: string;
    class_type: "children" | "adult";
    day_of_week: string;
    start_time: string;
    end_time: string;
    invite_only: boolean;
    location_note: string | null;
    venues: { name: string } | null;
  } | null;
  students: { first_name: string; last_name: string } | null;
}

interface InviteSessions {
  ids: string[];
  dates: string[];
}

/** How each plan reads on the card and in the basket. */
const PLAN_LABEL: Record<string, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  term: "Full term",
  yearly: "Full year",
  monthly: "Monthly membership",
};

/**
 * Cards on My Bookings for places the studio has set up for this family —
 * a private one-to-one, or any class an admin booked them onto. Book & pay
 * drops it into the basket and goes straight to checkout, so the ordinary
 * flow takes the payment (and, for a membership, the card).
 */
const OneToOneInvites = () => {
  const { user } = useAuth();
  const { addItem, items } = useCart();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<PortalInvite[]>([]);
  const [sessions, setSessions] = useState<Record<string, InviteSessions>>({});

  const load = useCallback(async () => {
    if (!user) { setInvites([]); return; }
    const { data } = await (supabase as any).from("class_invites")
      .select("id, class_id, student_id, price, plan, session_dates, classes:class_id(name, class_type, day_of_week, start_time, end_time, is_active, invite_only, location_note, venues:venue_id(name)), students:student_id(first_name, last_name)")
      .eq("parent_id", user.id)
      .eq("status", "pending");
    const rows = ((data ?? []) as any[]).filter((r) => r.classes?.is_active !== false) as PortalInvite[];
    if (rows.length === 0) { setInvites([]); return; }

    const classIds = rows.map((r) => r.class_id);
    const today = new Date().toISOString().slice(0, 10);
    // Normally only what's still to come is bookable. An invite that names
    // its own dates is different — the studio may be asking them to pay for
    // a class they've already been to — so those dates are fetched whatever
    // day they fall on.
    const namedDates = [...new Set(rows.flatMap((r) => r.session_dates ?? []))];
    const earliest = namedDates.length > 0 ? [...namedDates].sort()[0] : today;
    const [{ data: sessionRows }, { data: bookingRows }] = await Promise.all([
      supabase.from("class_sessions").select("id, class_id, session_date")
        .in("class_id", classIds)
        .gte("session_date", earliest < today ? earliest : today),
      supabase.from("bookings").select("class_id, student_id, notes").eq("parent_id", user.id).in("class_id", classIds).in("status", ["confirmed", "pending_payment"]),
    ]);
    const live = ((bookingRows as any[]) ?? []);
    const byClass = new Map<string, { id: string; session_date: string }[]>();
    for (const s of ((sessionRows as any[]) ?? []).sort((a, b) => a.session_date.localeCompare(b.session_date))) {
      byClass.set(s.class_id, [...(byClass.get(s.class_id) ?? []), s]);
    }
    // Per invite, not per class. Two children can be invited to the same
    // class on different nights, and keying this by class gave the second
    // one the first one's dates.
    const sessionByInvite: Record<string, InviteSessions> = {};
    for (const r of rows) {
      // When the invite names its dates, it means exactly those, even ones
      // that have already been — the studio is saying "you owe us for
      // Monday". Otherwise it's the whole run of upcoming sessions.
      const wanted = new Set(r.session_dates ?? []);
      const picked = (byClass.get(r.class_id) ?? []).filter((s) => (
        wanted.size > 0 ? wanted.has(s.session_date) : s.session_date >= today
      ));
      if (picked.length > 0) {
        sessionByInvite[r.id] = { ids: picked.map((s) => s.id), dates: picked.map((s) => s.session_date) };
      }
    }
    setSessions(sessionByInvite);
    // Hide an invite only once THIS place is actually held. Matching any
    // booking on the class is what lost Kirsty McAlpine her £10 link for
    // 16 September: her pass covered the 9th, and the 23rd, 30th, 7th and
    // 14th, so the one night she still owed for was filtered out of her own
    // account — while Amie could see it and had no way to send it again.
    setInvites(rows.filter((r) => (
      sessionByInvite[r.id]?.ids.length
      && !inviteAlreadyHeld({ status: "pending", session_dates: r.session_dates }, live.filter((b) => (
        b.class_id === r.class_id && (b.student_id ?? "") === (r.student_id ?? "")
      )))
    )));
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (invites.length === 0) return null;

  const bookInvite = (invite: PortalInvite) => {
    const session = sessions[invite.id];
    const cls = invite.classes;
    if (!session?.ids.length || !cls) return;

    // A place an admin set up on an ordinary class: open the class itself so
    // the usual booking flow prices it — sibling discounts, the £110 cap and
    // the membership card setup all belong to that flow, and a price we
    // guessed here would just be rejected at checkout.
    //
    // Unless the studio named a price for named dates. That's them saying
    // "this is what you owe for that class", which the class's own plans may
    // not even sell — so it goes straight in the basket at their price.
    const pricedByStudio = Number(invite.price) > 0 && invite.plan === "session" && (invite.session_dates?.length ?? 0) > 0;
    if (!cls.invite_only && !pricedByStudio) {
      // The class's own page, not the list of every class: it opens on the
      // plan the studio saved them (a trial place unlocks the trial even for
      // a family that has booked before) so "Confirm and pay" leads
      // somewhere they can actually finish.
      navigate(classLinkPath(invite.class_id));
      return;
    }
    if (!items.some((i) => i.classId === invite.class_id && i.studentId === invite.student_id)) {
      addItem({
        id: `invite-${invite.id}`,
        classId: invite.class_id,
        className: cls.name,
        classType: cls.class_type,
        danceStyle: null,
        dayOfWeek: cls.day_of_week,
        startTime: cls.start_time,
        endTime: cls.end_time,
        venueName: cls.venues?.name ?? cls.location_note ?? null,
        studentId: invite.student_id,
        studentName: invite.students ? `${invite.students.first_name} ${invite.students.last_name}` : null,
        pricingPlan: "session",
        unitPrice: Number(invite.price),
        totalPrice: Number(invite.price) * session.ids.length,
        sessionsCount: session.ids.length,
        termDiscountPercent: null,
        workshopImage: null,
        selectedSessionIds: session.ids,
        selectedSessionDates: session.dates.map((d) => format(parseISO(d), "d MMM")),
        itemKind: "class",
      });
    }
    toast.success("Added to your basket");
    navigate("/checkout");
  };

  return (
    <div className="mb-6 space-y-3">
      {invites.map((invite) => {
        const session = sessions[invite.id];
        const cls = invite.classes;
        const whenLine = [
          session
            ? session.dates.length === 1
              ? format(parseISO(session.dates[0]), "EEEE d MMMM")
              : `${session.dates.length} sessions: ${session.dates.map((d) => format(parseISO(d), "d MMM")).join(", ")}`
            : null,
          cls ? formatTimeRange(cls.start_time, cls.end_time) : null,
        ].filter(Boolean).join(" · ");
        const whereLine = cls?.venues?.name ?? cls?.location_note ?? null;
        return (
          <div key={invite.id} className="surface animate-rise-in border-primary/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-[13px] font-medium text-primary">
                  {cls?.invite_only ? "Invitation" : "A place saved for you"}
                </p>
                <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-foreground">
                  {cls?.invite_only
                    ? `${invite.students?.first_name ?? "Your dancer"} is invited: ${cls?.name}`
                    : `We've saved ${invite.students?.first_name ?? "you"} a place: ${cls?.name}`}
                </h3>
                {!cls?.invite_only && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {PLAN_LABEL[invite.plan] ?? "Booking"} — confirm it to secure the place
                  </p>
                )}
                {whenLine && <p className="mt-2 text-[15px] text-foreground/90">{whenLine}</p>}
                {whereLine && <p className="mt-0.5 text-[15px] text-muted-foreground">{whereLine}</p>}
                {cls?.invite_only && session && session.dates.length > 1 && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {formatPrice(Number(invite.price))} per session
                  </p>
                )}
              </div>
              <Button size="lg" className="h-12 shrink-0 rounded-full px-6" onClick={() => bookInvite(invite)}>
                {cls?.invite_only
                  ? `Book and pay ${formatPrice(Number(invite.price) * Math.max(1, session?.ids.length ?? 1))}`
                  : "Confirm and pay"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OneToOneInvites;
