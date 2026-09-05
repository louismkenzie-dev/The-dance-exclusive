import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CalendarDays, MapPin, User, Users, Clock, Tag, Plus, QrCode, MessageCircle, Ticket, Repeat } from "lucide-react";
import BookingQrDialog from "@/components/portal/BookingQrDialog";
import { ClassPassesPanel } from "@/components/portal/ClassPassesPanel";
import ChangeClassDialog from "@/components/portal/ChangeClassDialog";
import MoveSessionDialog from "@/components/portal/MoveSessionDialog";
import WorkshopCover from "@/components/WorkshopCover";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import AddressPrompt from "@/components/portal/AddressPrompt";
import OneToOneInvites from "@/components/portal/OneToOneInvites";
import { initialsOf } from "@/lib/initials";
import { UNLIMITED_MONTHLY_CAP } from "@/lib/pricing";

/** Cover images are stored as workshop-media storage paths — resolve to a URL. */
const getWorkshopImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
  return data?.publicUrl || null;
};

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

/** Display name of a membership's free month (memberships.free_month, default August). */
const freeMonthName = (freeMonth: number | null | undefined) =>
  format(new Date(2000, (freeMonth ?? 8) - 1, 1), "MMMM");

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  pending_payment: "secondary",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending Payment",
  cancelled: "Cancelled",
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
const membershipBadges: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "border-transparent bg-emerald-600 text-white" },
  past_due: { label: "Payment issue", className: "border-transparent bg-amber-500 text-white" },
  paused: { label: "Paused", className: "border-transparent bg-secondary text-secondary-foreground" },
  cancel_scheduled: { label: "Ending", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  cancelled: { label: "Ended", className: "border-transparent bg-muted text-muted-foreground" },
};

const MyBookings = () => {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBooking, setQrBooking] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("bookings");
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

  return (
    <div className="container py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold">My Bookings &amp; Memberships</h1>
        <Button asChild>
          <Link to={bookNowPath}>
            <Plus className="w-4 h-4 mr-2" /> Book a Class
          </Link>
        </Button>
      </div>

      {/* Home address — required for every family, prompted here for members
          who joined before it was collected at checkout. */}
      <AddressPrompt />
      <OneToOneInvites />

      {/* Active-pass prompt: visible on both tabs while credits remain */}
      {passCredits > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 mb-6 rounded-lg border border-primary/30 bg-primary/10 animate-fade-in">
          <p className="text-sm text-foreground">
            🎟️ You have <span className="font-bold">{passCredits}</span> class{passCredits === 1 ? "" : "es"} left to book on your pass — no payment needed
          </p>
          <Button size="sm" className="shrink-0" onClick={() => setActiveTab("passes")}>
            Book now
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="bookings" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> My Bookings
          </TabsTrigger>
          <TabsTrigger value="passes" className="gap-1.5">
            <Ticket className="w-3.5 h-3.5" /> Class Passes
          </TabsTrigger>
          <TabsTrigger value="memberships" className="gap-1.5">
            <Repeat className="w-3.5 h-3.5" /> Memberships
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-16 text-center space-y-4">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-semibold">No bookings yet</p>
              <p className="text-sm text-muted-foreground mt-1">Ready to start dancing? Browse our classes and book your first session!</p>
            </div>
            <Button asChild size="lg">
              <Link to={bookNowPath}>
                <CalendarDays className="w-4 h-4 mr-2" /> Browse Classes
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
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
            const coverImage = getWorkshopImageUrl(cls?.workshops?.cover_image);
            const coverPosition = cls?.workshops?.cover_position ?? "50% 25%";
            // Dated (per-session) bookings can be moved up to 24h before start.
            const sessionDate = sessionDateFromNotes(b.notes);
            const isMovable =
              b.status === "confirmed" &&
              MOVABLE_BOOKING_TYPES.has(b.booking_type) &&
              !!sessionDate &&
              !!b.class_id;
            const moveOpen = sessionDate ? moveStillOpen(sessionDate, cls?.start_time ?? null) : false;

            return (
              <Card key={b.id} className="card-elevated animate-fade-in overflow-hidden hover:border-primary/40 transition-colors">
                <CardContent className="py-0 px-0">
                  <div className="flex">
                    {/* Cover image strip */}
                    {coverImage && (
                      <div className="w-20 md:w-28 flex-shrink-0 bg-black/40">
                        <WorkshopCover
                          src={coverImage}
                          cover_position={coverPosition}
                          cover_zoom={cls?.workshops?.cover_zoom}
                          cover_fit={cls?.workshops?.cover_fit}
                        />
                      </div>
                    )}

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Title row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{cls?.name}</h3>
                            <Badge variant={statusColors[b.status] || "secondary"} className="text-[10px]">
                              {statusLabels[b.status] || b.status}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${isAdult ? "border-pink-500/40 text-pink-400" : "border-primary/40 text-primary"}`}>
                              {isAdult ? "Adult" : "Children's"} Class
                            </Badge>
                          </div>

                          {/* Schedule — dated bookings show their session date prominently */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {sessionDate ? (
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                                {format(parseISO(sessionDate), "EEE d MMM")}
                                {cls?.start_time && <> · {cls.start_time.slice(0, 5)}</>}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {cls?.day_of_week
                                  ? cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)
                                  : camp?.start_date && camp?.end_date
                                    ? `${camp.start_date.slice(8, 10)}/${camp.start_date.slice(5, 7)} – ${camp.end_date.slice(8, 10)}/${camp.end_date.slice(5, 7)}`
                                    : "—"}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {cls?.start_time?.slice(0, 5)} – {cls?.end_time?.slice(0, 5)}
                            </span>
                          </div>

                          {/* Dance style */}
                          {cls?.dance_style && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {cls.dance_style}
                            </p>
                          )}

                          {/* Student info — avatar leads on parent-facing cards, tap to enlarge */}
                          {student && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {student.profile_photo || student.avatar_url ? (
                                <PhotoAvatarDuo
                                  photoUrl={student.profile_photo}
                                  avatarUrl={student.avatar_url}
                                  initials={initialsOf(student.first_name, student.last_name)}
                                  size="sm"
                                  photoPrimary={false}
                                  expandable
                                />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {student.first_name} {student.last_name}
                                {student.preferred_name && <span className="text-muted-foreground"> "{student.preferred_name}"</span>}
                              </span>
                            </div>
                          )}

                          {/* Venue */}
                          {venue && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {venue.name}{venue.city && `, ${venue.city}`}{venue.postcode && ` ${venue.postcode}`}
                            </p>
                          )}

                          {/* Booking type & date */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                            {b.booking_type && b.booking_type !== "drop_in" && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {b.booking_type.replace(/_/g, " ")}
                              </Badge>
                            )}
                            <span>Booked: {format(new Date(b.booked_at), "d MMM yyyy")}</span>
                          </div>

                          {/* WhatsApp group link (confirmed bookings only) */}
                          {b.status === "confirmed" && cls?.whatsapp_group_url && (
                            <a
                              href={cls.whatsapp_group_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1DA851] mt-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Join the class WhatsApp group
                            </a>
                          )}
                        </div>

                        {/* Price + QR */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {b.amount != null && (
                            <span className="text-xl font-bold">£{Number(b.amount).toFixed(2)}</span>
                          )}
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQrBooking(b)}
                              className="gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" /> Sign-in QR
                            </Button>
                          )}
                          {isMovable && (moveOpen ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMoveTarget(b)}
                              className="gap-1.5"
                            >
                              <Repeat className="w-3.5 h-3.5" /> Move session
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground text-right max-w-[9rem]">
                              Locked — moves close 24h before the session
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="passes">
          <ClassPassesPanel onPassesChanged={fetchPassCredits} />
        </TabsContent>

        <TabsContent value="memberships">
          {membershipsLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : memberships.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center space-y-4">
                <Repeat className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="text-lg font-semibold">No memberships yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Choose Monthly Membership on any children&#39;s class and it becomes a rolling
                    monthly subscription — your child&#39;s place is saved every week, paid automatically each month.
                  </p>
                </div>
                <Button asChild size="lg">
                  <Link to="/classes/children">
                    <CalendarDays className="w-4 h-4 mr-2" /> Browse Children&#39;s Classes
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {memberships.map((m) => {
                // The payment date has passed with nothing taken. Derived from
                // the dates because the job that sets 'past_due' runs before
                // Stripe raises the invoices, so a failure on the 5th is not in
                // the status column until the next morning — and this is the
                // screen the family fixes it on.
                const paymentOverdue =
                  (m.status === "active" || m.status === "past_due" || m.status === "cancel_scheduled") &&
                  !!m.current_period_end &&
                  new Date(m.current_period_end).getTime() < Date.now();
                const badge = paymentOverdue
                  ? membershipBadges.past_due
                  : membershipBadges[m.status] ?? { label: m.status, className: "" };
                const cls = m.classes;
                const day = cls?.day_of_week
                  ? cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)
                  : null;
                // A studio credit/extra on the next payment changes the figure shown.
                const adjustment = nextPaymentAdjustment(m);
                const monthly = Number(m.monthly_amount);
                const adjustedPayment = adjustment ? Math.max(0, monthly + adjustment.amount) : monthly;
                const isStudioFreeMonth = !!adjustment && adjustment.amount < 0 && -adjustment.amount >= monthly - 0.005;
                return (
                  <Card key={m.id} className="card-elevated animate-fade-in">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{cls?.name ?? "Class membership"}</h3>
                            <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                              {badge.label}
                            </Badge>
                          </div>

                          {(day || cls?.start_time) && (
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {day && (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5" /> {day}s
                                </span>
                              )}
                              {cls?.start_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> {cls.start_time.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          )}

                          {m.students && (
                            <p className="text-sm flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              {m.students.first_name} {m.students.last_name}
                            </p>
                          )}

                          {m.status === "active" && !paymentOverdue && m.current_period_end && (
                            <div className="pt-1 space-y-0.5">
                              <p className="text-sm">
                                Paid up until <span className="font-medium">{format(new Date(m.current_period_end), "d MMM yyyy")}</span>
                              </p>
                              {isCapIncluded(m) ? (
                                <p className="text-sm text-muted-foreground">
                                  Nothing extra to pay — this class is included in{" "}
                                  {m.students?.first_name ?? "your child"}&#39;s £{UNLIMITED_MONTHLY_CAP} Unlimited.
                                </p>
                              ) : (
                                <>
                                  {adjustment ? (
                                    <p className="text-sm text-muted-foreground">
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
                                    <p className="text-sm text-muted-foreground">
                                      Next payment: {format(new Date(m.current_period_end), "d MMM yyyy")} — this
                                      covers {format(new Date(m.current_period_end), "MMMM")}&#39;s classes.
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    You pay 11 months a year — {freeMonthName(m.free_month)} is your free month.
                                  </p>
                                </>
                              )}
                            </div>
                          )}

                          {paymentOverdue && (
                            <div className="pt-1 space-y-2">
                              <p className="text-sm text-amber-600 dark:text-amber-400">
                                We couldn&#39;t take your last payment — it will be retried automatically,
                                or you can settle it right now.
                              </p>
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                disabled={payLinkLoading === m.id}
                                onClick={() => openPaymentLink(m.id)}
                              >
                                {payLinkLoading === m.id ? "Opening…" : "Pay now"}
                              </Button>
                            </div>
                          )}

                          {m.status === "paused" && (
                            <p className="text-sm text-muted-foreground pt-1">
                              Payments are paused for your free month — they restart automatically next month.
                            </p>
                          )}

                          {m.status === "cancel_scheduled" && (
                            <div className="pt-1 space-y-0.5">
                              {m.final_payment_date && (
                                <p className="text-sm">
                                  Final payment: <span className="font-medium">{format(new Date(m.final_payment_date), "d MMM yyyy")}</span>
                                </p>
                              )}
                              {m.cancel_at && (
                                <p className="text-sm">
                                  Membership ends: <span className="font-medium">{format(new Date(m.cancel_at), "d MMM yyyy")}</span>
                                </p>
                              )}
                            </div>
                          )}

                          {m.status === "cancelled" && (
                            <p className="text-sm text-muted-foreground pt-1">
                              Ended{(m.cancelled_at || m.cancel_at) && ` ${format(new Date((m.cancelled_at || m.cancel_at)!), "d MMM yyyy")}`}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {isCapIncluded(m) ? (
                            <span className="text-right">
                              <span className="block text-xl font-bold text-primary">Included</span>
                              <span className="block text-xs text-muted-foreground">£{UNLIMITED_MONTHLY_CAP} Unlimited</span>
                            </span>
                          ) : (
                            <span className="text-xl font-bold">
                              £{Number(m.monthly_amount).toFixed(2)}
                              <span className="text-sm font-normal text-muted-foreground">/month</span>
                            </span>
                          )}
                          {(m.status === "active" || m.status === "paused") && (
                            <Button size="sm" variant="outline" onClick={() => setChangeTarget(m)}>
                              <Repeat className="w-3.5 h-3.5 mr-1.5" /> Change class
                            </Button>
                          )}
                          {m.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setCancelTarget(m)}
                            >
                              Cancel membership
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this membership?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Monthly memberships require <strong>one month&#39;s written notice</strong> —
                  confirming below counts as your notice for{" "}
                  <strong>{cancelTarget?.classes?.name ?? "this class"}</strong>
                  {cancelTarget?.students && ` (${cancelTarget.students.first_name})`}.
                </p>
                {Number(cancelTarget?.monthly_amount ?? 0) === 0 ? (
                  <p>
                    This class is included free under the £{UNLIMITED_MONTHLY_CAP} Unlimited cap,
                    so there&#39;s no final payment to take for it.
                  </p>
                ) : (
                  <p>
                    Your final payment of <strong>£{Number(cancelTarget?.monthly_amount ?? 0).toFixed(2)}</strong> will
                    still be taken
                    {cancelTarget?.current_period_end
                      ? <> on <strong>{format(new Date(cancelTarget.current_period_end), "d MMM yyyy")}</strong></>
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep membership</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmCancelMembership(); }}
            >
              {cancelling ? "Cancelling..." : "Confirm cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyBookings;
