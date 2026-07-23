import { useCallback, useEffect, useState } from "react";
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
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, MapPin, User, Users, Clock, Tag, Plus, QrCode, MessageCircle, Ticket, Repeat } from "lucide-react";
import BookingQrDialog from "@/components/portal/BookingQrDialog";
import { ClassPassesPanel } from "@/components/portal/ClassPassesPanel";
import ChangeClassDialog from "@/components/portal/ChangeClassDialog";
import { getStripeEnvironment } from "@/lib/stripe";

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
  monthly_amount: number;
  started_at: string;
  current_period_end: string | null;
  final_payment_date: string | null;
  cancel_at: string | null;
  cancelled_at: string | null;
  students: { first_name: string; last_name: string; date_of_birth: string | null } | null;
  classes: { name: string; day_of_week: string | null; start_time: string | null } | null;
}

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
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  // Membership pending cancellation confirmation (controls the AlertDialog).
  const [cancelTarget, setCancelTarget] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Membership whose class is being changed (controls the ChangeClassDialog).
  const [changeTarget, setChangeTarget] = useState<Membership | null>(null);
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
          workshops(name, cover_image)
        ),
        camps(name, start_date, end_date, start_time, end_time, class_type,
          venues(name, address_line1, city, postcode),
          workshops(name, cover_image)
        ),
        students(first_name, last_name, preferred_name, profile_photo)`)
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
    if (!user) { setMemberships([]); return; }
    const { data } = await supabase
      .from("memberships")
      .select("id, status, class_id, monthly_amount, started_at, current_period_end, final_payment_date, cancel_at, cancelled_at, students(first_name, last_name, date_of_birth), classes(name, day_of_week, start_time)")
      .eq("user_id", user.id)
      .neq("status", "incomplete") // never surface half-created subscriptions
      .order("created_at", { ascending: false });
    setMemberships((data as unknown as Membership[]) ?? []);
    setMembershipsLoading(false);
  }, [user]);
  useEffect(() => { fetchMemberships(); }, [fetchMemberships]);

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

  const confirmCancelMembership = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: { action: "cancel", membershipId: cancelTarget.id, environment: getStripeEnvironment() },
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
            const coverImage = cls?.workshops?.cover_image;

            return (
              <Card key={b.id} className="card-elevated animate-fade-in overflow-hidden hover:border-primary/40 transition-colors">
                <CardContent className="py-0 px-0">
                  <div className="flex">
                    {/* Cover image strip */}
                    {coverImage && (
                      <div className="w-20 md:w-28 flex-shrink-0">
                        <img src={coverImage} alt="" className="w-full h-full object-cover" />
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

                          {/* Schedule */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {cls?.day_of_week
                                ? cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)
                                : camp?.start_date && camp?.end_date
                                  ? `${camp.start_date.slice(8, 10)}/${camp.start_date.slice(5, 7)} – ${camp.end_date.slice(8, 10)}/${camp.end_date.slice(5, 7)}`
                                  : "—"}
                            </span>
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

                          {/* Student info */}
                          {student && (
                            <div className="flex items-center gap-2 mt-1">
                              {student.profile_photo ? (
                                <img src={student.profile_photo} alt="" className="w-5 h-5 rounded-full object-cover" />
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
                const badge = membershipBadges[m.status] ?? { label: m.status, className: "" };
                const cls = m.classes;
                const day = cls?.day_of_week
                  ? cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)
                  : null;
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

                          {m.status === "active" && m.current_period_end && (
                            <div className="pt-1 space-y-0.5">
                              <p className="text-sm">
                                Valid until <span className="font-medium">{format(new Date(m.current_period_end), "d MMM yyyy")}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Next payment: {format(new Date(m.current_period_end), "d MMM yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">Payments pause in August</p>
                            </div>
                          )}

                          {m.status === "past_due" && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 pt-1">
                              We couldn&#39;t take your last payment — it will be retried automatically.
                              Please check your card details.
                            </p>
                          )}

                          {m.status === "paused" && (
                            <p className="text-sm text-muted-foreground pt-1">
                              Payments are paused for August — they restart automatically in September.
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
                          <span className="text-xl font-bold">
                            £{Number(m.monthly_amount).toFixed(2)}
                            <span className="text-sm font-normal text-muted-foreground">/month</span>
                          </span>
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
                <p>
                  Your final payment of <strong>£{Number(cancelTarget?.monthly_amount ?? 0).toFixed(2)}</strong> will
                  still be taken
                  {cancelTarget?.current_period_end
                    ? <> on <strong>{format(new Date(cancelTarget.current_period_end), "d MMM yyyy")}</strong></>
                    : " on your next charge date"}.
                </p>
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
