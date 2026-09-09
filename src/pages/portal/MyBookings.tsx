import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, QrCode } from "lucide-react";
import BookingQrDialog from "@/components/portal/BookingQrDialog";
import { ClassPassesPanel } from "@/components/portal/ClassPassesPanel";
import ChangeClassDialog from "@/components/portal/ChangeClassDialog";
import MoveSessionDialog from "@/components/portal/MoveSessionDialog";
import AddressPrompt from "@/components/portal/AddressPrompt";
import OneToOneInvites from "@/components/portal/OneToOneInvites";
import { initialsOf } from "@/lib/initials";
import { UNLIMITED_MONTHLY_CAP } from "@/lib/pricing";
import { SectionHeading } from "@/components/booking/SectionHeading";
import { Chip, ChipRow } from "@/components/booking/Chips";
import { EmptyState } from "@/components/booking/EmptyState";
import { QuietNotice } from "@/components/booking/QuietNotice";
import { QuietPill } from "@/components/booking/QuietPill";
import { AttendeeAvatar } from "@/components/booking/AttendeeAvatar";
import { RecordCardSkeleton } from "@/components/booking/PortalSkeletons";
import { formatDay, formatPrice, formatTime, formatTimeRange } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

/** Dated bookings carry their session date in notes: "... | session YYYY-MM-DD". */
const sessionDateFromNotes = (notes: string | null | undefined): string | null =>
  notes?.match(/session (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

/** Booking types that can be moved to another session (server enforces the rest). */
const MOVABLE_BOOKING_TYPES = new Set(["trial", "session", "drop_in"]);

/** Client-side approximation of the 24h move cutoff (local time — the
 *  move-booking-session endpoint enforces the real London-time rule). */
const moveStillOpen = (dateStr: string, startTime: string | null): boolean =>
  new Date(`${dateStr}T${(startTime ?? "00:00").slice(0, 5)}:00`).getTime() - Date.now() >=
  24 * 3600_000;

/**
 * A dated booking (trial, pay-as-you-go) is over once its class has finished.
 * The sign-in QR and the move controls only make sense before then — a
 * parent looking at last Saturday's trial doesn't need a door code for it.
 */
const sessionOver = (dateStr: string, endTime: string | null): boolean =>
  new Date(`${dateStr}T${(endTime ?? "23:59").slice(0, 5)}:00`).getTime() < Date.now();

/** Display name of a membership's free month (memberships.free_month, default August). */
const freeMonthName = (freeMonth: number | null | undefined) =>
  format(new Date(2000, (freeMonth ?? 8) - 1, 1), "MMMM");

/** Only states worth flagging get a pill; a confirmed booking is simply a booking. */
const bookingStatusPill: Record<string, { label: string; tone: "warning" | "neutral" }> = {
  pending_payment: { label: "Pending payment", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** How a booking type reads on its card. */
const bookingTypeLabel: Record<string, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  term: "Term",
  yearly: "Year",
  monthly: "Monthly membership",
};

interface Membership {
  id: string;
  status: string;
  class_id: string | null;
  student_id: string | null;
  monthly_amount: number;
  started_at: string;
  current_period_end: string | null;
  final_payment_date: string | null;
  cancel_at: string | null;
  cancelled_at: string | null;
  free_month: number | null;
  students: { first_name: string; last_name: string; date_of_birth: string | null } | null;
  classes: { name: string; day_of_week: string | null; start_time: string | null } | null;
}

/** A one-off change the studio has made to a single month's payment —
 *  negative = credit (money off), positive = extra agreed with the family. */
interface MembershipAdjustment {
  membership_id: string;
  /** First day of the month whose payment it changes, "YYYY-MM-DD". */
  billing_month: string;
  amount: number;
}

/** "YYYY-MM" of the calendar month a payment date falls in. Payments land at
 *  ~07:00 UTC on the 5th, so the UTC month is the right one. */
const paymentMonthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// 'incomplete' rows are filtered out of the query entirely, so no entry here.
const membershipStatus: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success" },
  past_due: { label: "Payment issue", className: "text-warning" },
  paused: { label: "Paused", className: "text-muted-foreground" },
  cancel_scheduled: { label: "Ending", className: "text-muted-foreground" },
  cancelled: { label: "Ended", className: "text-muted-foreground" },
};

type TabKey = "bookings" | "passes" | "memberships";
const TABS: { key: TabKey; label: string }[] = [
  { key: "bookings", label: "My bookings" },
  { key: "passes", label: "Class passes" },
  { key: "memberships", label: "Memberships" },
];

const actionButton = "h-11 rounded-full px-4 text-[14px] font-medium";
const textLink = "inline-flex h-11 items-center px-1 text-[14px] font-medium text-primary hover:underline";

const MyBookings = () => {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBooking, setQrBooking] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("bookings");
  // Total classes still bookable across the user's active passes (for the prompt banner).
  const [passCredits, setPassCredits] = useState(0);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  // Studio credits / extras that change one specific month's payment.
  const [adjustments, setAdjustments] = useState<MembershipAdjustment[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [payLinkLoading, setPayLinkLoading] = useState<string | null>(null);
  // Membership pending cancellation confirmation (controls the AlertDialog).
  const [cancelTarget, setCancelTarget] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Membership whose class is being changed (controls the ChangeClassDialog).
  const [changeTarget, setChangeTarget] = useState<Membership | null>(null);
  // Dated booking being moved to another session (controls the MoveSessionDialog).
  const [moveTarget, setMoveTarget] = useState<any | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const customerType = profile?.customer_type as string | null;
  const primaryIsAdult = customerType === "adult_dancer";

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select(`*,
        classes(name, day_of_week, start_time, end_time, class_type, dance_style, price_per_session, price_per_term, price_per_month, price_per_year, whatsapp_group_url,
          venues(name, address_line1, city, postcode),
          workshops(name, cover_image, cover_position, cover_zoom, cover_fit)
        ),
        camps(name, start_date, end_date, start_time, end_time, class_type,
          venues(name, address_line1, city, postcode),
          workshops(name, cover_image, cover_position, cover_zoom, cover_fit)
        ),
        students(first_name, last_name, preferred_name, profile_photo, avatar_url)`)
      .eq("parent_id", user.id)
      .order("booked_at", { ascending: false });
    if (data) setBookings(data);
    setLoading(false);
  }, [user]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const fetchPassCredits = useCallback(async () => {
    if (!user) { setPassCredits(0); return; }
    const { data } = await supabase
      .from("class_passes")
      .select("sessions_remaining")
      .eq("user_id", user.id)
      .gt("sessions_remaining", 0)
      .gte("expires_at", new Date().toISOString());
    setPassCredits((data ?? []).reduce((sum, p) => sum + (p.sessions_remaining ?? 0), 0));
  }, [user]);
  useEffect(() => { fetchPassCredits(); }, [fetchPassCredits]);

  const fetchMemberships = useCallback(async () => {
    if (!user) { setMemberships([]); setAdjustments([]); return; }
    const [{ data }, { data: adjustmentRows }] = await Promise.all([
      supabase
        .from("memberships")
        .select("id, status, class_id, student_id, monthly_amount, started_at, current_period_end, final_payment_date, cancel_at, cancelled_at, free_month, students(first_name, last_name, date_of_birth), classes(name, day_of_week, start_time)")
        .eq("user_id", user.id)
        .neq("status", "incomplete") // never surface half-created subscriptions
        .order("created_at", { ascending: false }),
      // Only the parent's own rows come back (RLS); removed ones no longer apply.
      supabase
        .from("membership_adjustments")
        .select("membership_id, billing_month, amount")
        .eq("user_id", user.id)
        .in("status", ["pending", "applied"]),
    ]);
    setMemberships((data as unknown as Membership[]) ?? []);
    setAdjustments((adjustmentRows ?? []).map((a) => ({ ...a, amount: Number(a.amount) })));
    setMembershipsLoading(false);
  }, [user]);
  useEffect(() => { fetchMemberships(); }, [fetchMemberships]);

  /** The studio's credit (or extra) on this membership's NEXT payment, if any. */
  const nextPaymentAdjustment = (m: Membership): MembershipAdjustment | null => {
    if (!m.current_period_end) return null;
    const key = paymentMonthKey(m.current_period_end);
    return adjustments.find((a) => a.membership_id === m.id && a.billing_month.slice(0, 7) === key) ?? null;
  };

  // Per-child live monthly totals. A £0 membership only happens when the
  // £110 Unlimited cap absorbed the class — the card should say that, not
  // "£0.00/month", which reads like a billing mistake.
  const liveMonthlyByStudent = useMemo(() => {
    const live = new Set(["active", "paused", "past_due", "cancel_scheduled"]);
    const totals = new Map<string, number>();
    for (const m of memberships) {
      if (!m.student_id || !live.has(m.status)) continue;
      totals.set(m.student_id, (totals.get(m.student_id) ?? 0) + Number(m.monthly_amount));
    }
    return totals;
  }, [memberships]);

  const isCapIncluded = (m: Membership) =>
    Number(m.monthly_amount) === 0 &&
    !!m.student_id &&
    (liveMonthlyByStudent.get(m.student_id) ?? 0) >= UNLIMITED_MONTHLY_CAP - 0.01;

  // Email deep-link: /account/bookings?qr=<bookingId> auto-opens the sign-in QR
  // dialog for that booking once, then clears the param so it can't re-trigger.
  useEffect(() => {
    const qrId = searchParams.get("qr");
    if (!qrId || loading) return;
    const target = bookings.find((b) => b.id === qrId);
    if (target) setQrBooking(target);
    const next = new URLSearchParams(searchParams);
    next.delete("qr");
    setSearchParams(next, { replace: true });
  }, [bookings, loading, searchParams, setSearchParams]);

  // Stripe hosted invoice page for a failed membership payment — pays the
  // outstanding month (any card) and registers immediately.
  const openPaymentLink = async (membershipId: string) => {
    setPayLinkLoading(membershipId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: { action: "payment_link", membershipId },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (data?.url) {
        window.open(data.url, "_blank", "noopener");
      } else {
        toast.error("Couldn't open the payment page", { description: message || "Please try again or contact us." });
      }
    } finally {
      setPayLinkLoading(null);
    }
  };

  const confirmCancelMembership = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: { action: "cancel", membershipId: cancelTarget.id },
      });
      // supabase-js hides the function's JSON body behind error.context —
      // surface the server's friendly message instead of the generic one.
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || data?.error) {
        toast.error("Could not cancel membership", { description: message || "Please try again" });
      } else {
        toast.success("Cancellation notice received", {
          description: `Final payment on ${format(new Date(data.finalPaymentDate), "d MMM yyyy")} — membership ends ${format(new Date(data.endDate), "d MMM yyyy")}`,
        });
        setCancelTarget(null);
        fetchMemberships();
      }
    } catch (e: any) {
      toast.error("Could not cancel membership", { description: e?.message });
    } finally {
      setCancelling(false);
    }
  };

  const bookNowPath = primaryIsAdult ? "/classes/adult" : "/classes/children";

  const renderBookingCard = (b: any) => {
    const camp = b.camps;
    // Camp (holiday workshop) bookings have no class row — surface the
    // camp's details through the same card shape.
    const cls = b.classes ?? (camp ? {
      name: camp.name,
      day_of_week: null,
      start_time: camp.start_time,
      end_time: camp.end_time,
      class_type: camp.class_type,
      dance_style: null,
      whatsapp_group_url: null,
      venues: camp.venues,
      workshops: camp.workshops,
    } : null);
    const student = b.students;
    const venue = cls?.venues;
    const isAdult = cls?.class_type === "adult";
    // Dated (per-session) bookings can be moved up to 24h before start.
    const sessionDate = sessionDateFromNotes(b.notes);
    const isMovable =
      b.status === "confirmed" &&
      MOVABLE_BOOKING_TYPES.has(b.booking_type) &&
      !!sessionDate &&
      !!b.class_id;
    const moveOpen = sessionDate ? moveStillOpen(sessionDate, cls?.start_time ?? null) : false;
    const over = sessionDate ? sessionOver(sessionDate, cls?.end_time ?? null) : false;

    const timeRange = formatTimeRange(cls?.start_time, cls?.end_time);
    const whenLine = sessionDate
      ? [format(parseISO(sessionDate), "EEE d MMM"), timeRange].filter(Boolean).join(" · ")
      : cls?.day_of_week
        ? [formatDay(cls.day_of_week, "plural"), timeRange].filter(Boolean).join(" · ")
        : camp?.start_date && camp?.end_date
          ? [`${format(parseISO(camp.start_date), "EEE d MMM")} – ${format(parseISO(camp.end_date), "EEE d MMM")}`, timeRange].filter(Boolean).join(" · ")
          : timeRange || "—";
    const venueLine = venue
      ? `${venue.name}${venue.city ? `, ${venue.city}` : ""}${venue.postcode ? ` ${venue.postcode}` : ""}`
      : null;
    const pill = bookingStatusPill[b.status] ?? (b.status !== "confirmed" ? { label: b.status, tone: "neutral" as const } : null);
    const metaLine = [
      b.booking_type && b.booking_type !== "drop_in"
        ? bookingTypeLabel[b.booking_type] ?? b.booking_type.replace(/_/g, " ")
        : null,
      b.amount != null ? formatPrice(Number(b.amount)) : null,
      `Booked ${format(new Date(b.booked_at), "d MMM yyyy")}`,
    ].filter(Boolean).join(" · ");

    const actions: ReactNode[] = [];
    if (b.status === "confirmed" && !over) {
      actions.push(
        <Button key="qr" variant="soft" className={actionButton} onClick={() => setQrBooking(b)}>
          <QrCode className="h-4 w-4" /> Sign-in QR
        </Button>,
      );
    }
    if (isMovable && !over) {
      actions.push(
        moveOpen ? (
          <Button key="move" variant="ghost" className={actionButton} onClick={() => setMoveTarget(b)}>
            Move session
          </Button>
        ) : (
          <span key="locked" className="inline-flex h-11 items-center px-1 text-[13px] text-muted-foreground">
            Locked — moves close 24h before the session
          </span>
        ),
      );
    }
    if (b.class_id && !sessionDate) {
      actions.push(
        <Link key="dates" to={`/term-dates#class-${b.class_id}`} className={textLink}>
          Class dates
        </Link>,
      );
    }
    if (b.status === "confirmed" && cls?.whatsapp_group_url) {
      actions.push(
        <a
          key="whatsapp"
          href={cls.whatsapp_group_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(textLink, "gap-1.5")}
        >
          <MessageCircle className="h-4 w-4" /> Class WhatsApp group
        </a>,
      );
    }
    if (over) {
      actions.push(
        <span key="over" className="inline-flex h-11 items-center px-1 text-[13px] text-muted-foreground">
          Session has passed
        </span>,
      );
    }

    return (
      <article key={b.id} className="surface animate-rise-in p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">
            {[cls?.dance_style, isAdult ? "Adults" : "Children"].filter(Boolean).join(" · ")}
          </p>
          {pill && <QuietPill tone={pill.tone}>{pill.label}</QuietPill>}
        </div>
        <h3 className="mt-1 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{cls?.name}</h3>
        <p className="mt-2 text-[15px] text-foreground/90">{whenLine}</p>
        {venueLine && <p className="mt-0.5 text-[15px] text-muted-foreground">{venueLine}</p>}

        {student && (
          <div className="mt-4 flex items-center gap-3">
            <AttendeeAvatar
              initials={initialsOf(student.first_name, student.last_name)}
              photoUrl={student.profile_photo}
              avatarUrl={student.avatar_url}
            />
            <p className="min-w-0 text-[15px] font-medium text-foreground">
              {student.first_name} {student.last_name}
              {student.preferred_name && <span className="font-normal text-muted-foreground"> "{student.preferred_name}"</span>}
            </p>
          </div>
        )}

        <p className="mt-4 text-[13px] text-muted-foreground">{metaLine}</p>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-4">
            {actions}
          </div>
        )}
      </article>
    );
  };

  const renderMembershipCard = (m: Membership) => {
    // The payment date has passed with nothing taken. Derived from
    // the dates because the job that sets 'past_due' runs before
    // Stripe raises the invoices, so a failure on the 5th is not in
    // the status column until the next morning — and this is the
    // screen the family fixes it on.
    const paymentOverdue =
      (m.status === "active" || m.status === "past_due" || m.status === "cancel_scheduled") &&
      !!m.current_period_end &&
      new Date(m.current_period_end).getTime() < Date.now();
    const status = paymentOverdue
      ? membershipStatus.past_due
      : membershipStatus[m.status] ?? { label: m.status, className: "text-muted-foreground" };
    const cls = m.classes;
    const whenLine = [
      cls?.day_of_week ? formatDay(cls.day_of_week, "plural") : null,
      cls?.start_time ? formatTime(cls.start_time) : null,
    ].filter(Boolean).join(" · ");
    // A studio credit/extra on the next payment changes the figure shown.
    const adjustment = nextPaymentAdjustment(m);
    const monthly = Number(m.monthly_amount);
    const adjustedPayment = adjustment ? Math.max(0, monthly + adjustment.amount) : monthly;
    const isStudioFreeMonth = !!adjustment && adjustment.amount < 0 && -adjustment.amount >= monthly - 0.005;
    const capIncluded = isCapIncluded(m);

    return (
      <article key={m.id} className="surface animate-rise-in p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">Monthly membership</p>
          <span className={cn("shrink-0 text-[13px] font-medium", status.className)}>{status.label}</span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-4">
          <h3 className="min-w-0 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{cls?.name ?? "Class membership"}</h3>
          <div className="shrink-0 text-right">
            {capIncluded ? (
              <>
                <p className="text-[17px] font-semibold text-foreground">Included</p>
                <p className="text-[13px] text-muted-foreground">£{UNLIMITED_MONTHLY_CAP} Unlimited</p>
              </>
            ) : (
              <p className="text-[17px] font-semibold tabular-nums text-foreground">
                {formatPrice(Number(m.monthly_amount))}
                <span className="text-[13px] font-normal text-muted-foreground">/month</span>
              </p>
            )}
          </div>
        </div>
        {whenLine && <p className="mt-2 text-[15px] text-foreground/90">{whenLine}</p>}

        {m.students && (
          <div className="mt-4 flex items-center gap-3">
            <AttendeeAvatar initials={initialsOf(m.students.first_name, m.students.last_name)} />
            <p className="text-[15px] font-medium text-foreground">
              {m.students.first_name} {m.students.last_name}
            </p>
          </div>
        )}

        {m.status === "active" && !paymentOverdue && m.current_period_end && (
          <div className="mt-4 space-y-1">
            <p className="text-[15px] text-foreground">
              Paid up until <span className="font-medium">{format(new Date(m.current_period_end), "d MMM yyyy")}</span>
            </p>
            {capIncluded ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nothing extra to pay — this class is included in{" "}
                {m.students?.first_name ?? "your child"}'s £{UNLIMITED_MONTHLY_CAP} Unlimited.
              </p>
            ) : (
              <>
                {adjustment ? (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Next payment:{" "}
                    <span className="font-medium text-foreground">£{adjustedPayment.toFixed(2)}</span>{" "}
                    on {format(new Date(m.current_period_end), "d MMMM")} —{" "}
                    {adjustment.amount < 0
                      ? isStudioFreeMonth
                        ? "your free month from the studio"
                        : `includes £${(-adjustment.amount).toFixed(2)} credit from the studio`
                      : `includes £${adjustment.amount.toFixed(2)} extra agreed with the studio`}.
                  </p>
                ) : (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Next payment: {format(new Date(m.current_period_end), "d MMM yyyy")} — this
                    covers {format(new Date(m.current_period_end), "MMMM")}'s classes.
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  You pay 11 months a year — {freeMonthName(m.free_month)} is your free month.
                </p>
              </>
            )}
          </div>
        )}

        {paymentOverdue && (
          <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 p-4">
            <p className="text-[15px] leading-relaxed text-foreground">
              We couldn't take your last payment — it will be retried automatically,
              or you can settle it right now.
            </p>
            <Button
              className="mt-3 h-11 rounded-full bg-warning px-5 text-warning-foreground hover:bg-warning/90"
              disabled={payLinkLoading === m.id}
              onClick={() => openPaymentLink(m.id)}
            >
              {payLinkLoading === m.id ? "Opening…" : "Pay now"}
            </Button>
          </div>
        )}

        {m.status === "paused" && (
          <p className="mt-4 text-[15px] text-muted-foreground">
            Payments are paused for your free month — they restart automatically next month.
          </p>
        )}

        {m.status === "cancel_scheduled" && (
          <div className="mt-4 space-y-1">
            {m.final_payment_date && (
              <p className="text-[15px] text-foreground">
                Final payment: <span className="font-medium">{format(new Date(m.final_payment_date), "d MMM yyyy")}</span>
              </p>
            )}
            {m.cancel_at && (
              <p className="text-[15px] text-foreground">
                Membership ends: <span className="font-medium">{format(new Date(m.cancel_at), "d MMM yyyy")}</span>
              </p>
            )}
          </div>
        )}

        {m.status === "cancelled" && (
          <p className="mt-4 text-[15px] text-muted-foreground">
            Ended{(m.cancelled_at || m.cancel_at) && ` ${format(new Date((m.cancelled_at || m.cancel_at)!), "d MMM yyyy")}`}
          </p>
        )}

        {(m.class_id || m.status === "active" || m.status === "paused") && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-4">
            {(m.status === "active" || m.status === "paused") && (
              <Button variant="soft" className={actionButton} onClick={() => setChangeTarget(m)}>
                Change class
              </Button>
            )}
            {m.class_id && (
              <Link to={`/term-dates#class-${m.class_id}`} className={textLink}>
                Class dates
              </Link>
            )}
            {m.status === "active" && (
              <Button
                variant="ghost"
                className={cn(actionButton, "ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive")}
                onClick={() => setCancelTarget(m)}
              >
                Cancel membership
              </Button>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="container max-w-3xl py-8 sm:py-12">
      <SectionHeading
        as="h1"
        size="page"
        title="My bookings"
        aside={
          <Button asChild size="lg" className="rounded-full">
            <Link to={bookNowPath}>Book a class</Link>
          </Button>
        }
        className="mb-8"
      />

      {/* Home address — required for every family, prompted here for members
          who joined before it was collected at checkout. */}
      <AddressPrompt />
      <OneToOneInvites />

      {/* Active-pass prompt: visible on both tabs while credits remain */}
      {passCredits > 0 && (
        <QuietNotice
          tone="brand"
          className="mb-6 animate-rise-in"
          title={`${passCredits} class${passCredits === 1 ? "" : "es"} left to book on your pass`}
          action={
            <Button size="sm" className="h-10 rounded-full px-4" onClick={() => setActiveTab("passes")}>
              Book now
            </Button>
          }
        >
          No payment needed — your pass covers it.
        </QuietNotice>
      )}

      <ChipRow className="mb-6">
        {TABS.map((t) => (
          <Chip key={t.key} selected={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </Chip>
        ))}
      </ChipRow>

      {activeTab === "bookings" && (
        loading ? (
          <div className="space-y-4">
            <RecordCardSkeleton />
            <RecordCardSkeleton />
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            body="Browse our classes and book your first session."
            action={
              <Button asChild size="lg" className="rounded-full">
                <Link to={bookNowPath}>Browse classes</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">{bookings.map(renderBookingCard)}</div>
        )
      )}

      {activeTab === "passes" && <ClassPassesPanel onPassesChanged={fetchPassCredits} />}

      {activeTab === "memberships" && (
        membershipsLoading ? (
          <div className="space-y-4">
            <RecordCardSkeleton />
          </div>
        ) : memberships.length === 0 ? (
          <EmptyState
            title="No memberships yet"
            body="Choose Monthly membership on any children's class and it becomes a rolling monthly subscription — your child's place is saved every week, paid automatically each month."
            action={
              <Button asChild size="lg" className="rounded-full">
                <Link to="/classes/children">Browse children's classes</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">{memberships.map(renderMembershipCard)}</div>
        )
      )}

      <BookingQrDialog
        open={!!qrBooking}
        onOpenChange={(o) => !o && setQrBooking(null)}
        booking={qrBooking}
      />

      <ChangeClassDialog
        open={!!changeTarget}
        onOpenChange={(o) => { if (!o) setChangeTarget(null); }}
        membership={changeTarget ? {
          id: changeTarget.id,
          class_id: changeTarget.class_id,
          className: changeTarget.classes?.name ?? "your class",
          studentName: changeTarget.students ? `${changeTarget.students.first_name} ${changeTarget.students.last_name}` : null,
          studentDob: changeTarget.students?.date_of_birth ?? null,
          monthly_amount: Number(changeTarget.monthly_amount),
        } : null}
        onSwitched={() => { fetchMemberships(); fetchBookings(); }}
      />

      <MoveSessionDialog
        open={!!moveTarget}
        onOpenChange={(o) => { if (!o) setMoveTarget(null); }}
        booking={moveTarget ? {
          id: moveTarget.id,
          classId: moveTarget.class_id,
          className: moveTarget.classes?.name ?? "your class",
          bookingType: moveTarget.booking_type,
          sessionDate: sessionDateFromNotes(moveTarget.notes) ?? "",
          classType: (moveTarget.classes?.class_type ?? "children") as "children" | "adult",
          studentName: moveTarget.students
            ? `${moveTarget.students.first_name} ${moveTarget.students.last_name}`
            : null,
        } : null}
        onMoved={fetchBookings}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o && !cancelling) setCancelTarget(null); }}>
        <AlertDialogContent className="portal-ui rounded-2xl border-border bg-card p-6 sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight text-foreground">Cancel this membership?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[15px] leading-relaxed text-muted-foreground">
                <p>
                  Monthly memberships require <strong className="font-medium text-foreground">one month's written notice</strong> —
                  confirming below counts as your notice for{" "}
                  <strong className="font-medium text-foreground">{cancelTarget?.classes?.name ?? "this class"}</strong>
                  {cancelTarget?.students && ` (${cancelTarget.students.first_name})`}.
                </p>
                {Number(cancelTarget?.monthly_amount ?? 0) === 0 ? (
                  <p>
                    This class is included free under the £{UNLIMITED_MONTHLY_CAP} Unlimited cap,
                    so there's no final payment to take for it.
                  </p>
                ) : (
                  <p>
                    Your final payment of <strong className="font-medium text-foreground">£{Number(cancelTarget?.monthly_amount ?? 0).toFixed(2)}</strong> will
                    still be taken
                    {cancelTarget?.current_period_end
                      ? <> on <strong className="font-medium text-foreground">{format(new Date(cancelTarget.current_period_end), "d MMM yyyy")}</strong></>
                      : " on your next charge date"}.
                  </p>
                )}
                <p>
                  The membership stays active until one month after that payment, then ends
                  automatically — classes continue as normal until then.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={cancelling} className="mt-0 h-11 rounded-xl border-border bg-card text-foreground hover:bg-muted">
              Keep membership
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              className="h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmCancelMembership(); }}
            >
              {cancelling ? "Cancelling…" : "Confirm cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyBookings;
