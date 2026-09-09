import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ClipboardList, Clock, MapPin, Plus, Users, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/booking/EmptyState";
import { formatTimeRange } from "@/lib/bookingFormat";
import { bookingCountsOnDate } from "@/lib/registerRules";
import { paymentRefOf } from "@/lib/bookingBreakdown";
import AddBookingDialog from "@/components/admin/AddBookingDialog";
import BookingBreakdown, { type PaymentSibling } from "@/components/admin/BookingBreakdown";
import { BookingActions } from "@/components/admin/BookingActions";
import { CancelSessionSheet } from "@/components/admin/CancelSessionSheet";
import { StatusPill, TonePill, planLabel } from "@/components/admin/StatusPill";
import { useBookingActions } from "@/components/admin/useBookingActions";

/** Fewer than this booked on and the class needs Amie's attention — the
 *  same line the Dashboard draws. */
const QUIET_CLASS_THRESHOLD = 3;

interface SessionRow {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  classes: {
    name: string;
    class_type: "children" | "adult";
    capacity: number | null;
    day_of_week: string | null;
    invite_only: boolean | null;
    start_time: string | null;
    end_time: string | null;
    price_per_session: number | null;
    price_per_term: number | null;
    price_per_month: number | null;
    price_per_year: number | null;
    term_end: string | null;
    venues: { name: string } | null;
  } | null;
}

interface BookingRow {
  id: string;
  parent_id: string;
  student_id: string | null;
  class_id: string | null;
  status: string;
  booking_type: string;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  students: { first_name: string; last_name: string; preferred_name: string | null; is_self: boolean | null } | null;
  classes: {
    name: string;
    class_type: "children" | "adult";
    start_time: string | null;
    end_time: string | null;
    price_per_session: number | null;
    price_per_term: number | null;
    price_per_month: number | null;
    price_per_year: number | null;
    term_end: string | null;
  } | null;
  profiles: { full_name: string; email: string; phone: string | null } | null;
}

interface AttendanceRow {
  booking_id: string;
  status: string;
  checked_in_at: string | null;
}

const dancerName = (b: BookingRow) =>
  b.students ? `${b.students.preferred_name || b.students.first_name} ${b.students.last_name}` : "Adult booking";

/** The last "Cancelled …" line the cancel flow wrote on the session. */
const cancelNoteOf = (notes: string | null) => {
  const lines = (notes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return [...lines].reverse().find((l) => /^cancelled/i.test(l)) ?? null;
};

/**
 * One class session's own page: who is booked on that date, everything the
 * studio can do to each of those bookings, and the emergency button for the
 * class itself. Reached from the Dashboard's upcoming list.
 */
const AdminClassSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const { actions, dialogs } = useBookingActions({ onChanged: reload });

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      const { data: s } = await supabase
        .from("class_sessions")
        .select("id, class_id, session_date, start_time, end_time, status, notes, classes:class_id ( name, class_type, capacity, day_of_week, invite_only, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, term_end, venues:venue_id ( name ) )")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (!s) {
        setMissing(true);
        setLoading(false);
        return;
      }
      const sess = s as unknown as SessionRow;
      setSession(sess);

      const [{ data: explicit }, { data: usual }, { data: rows }, { data: att }] = await Promise.all([
        supabase.from("session_instructors").select("staff:staff_id ( first_name, full_name )").eq("session_id", sess.id),
        supabase.from("class_instructors").select("staff:staff_id ( first_name, full_name )").eq("class_id", sess.class_id),
        supabase
          .from("bookings")
          .select("id, parent_id, student_id, class_id, status, booking_type, amount, booked_at, notes, students:student_id ( first_name, last_name, preferred_name, is_self ), classes:class_id ( name, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, term_end )")
          .eq("class_id", sess.class_id)
          .in("status", ["confirmed", "pending_payment"]),
        supabase.from("attendance").select("booking_id, status, checked_in_at").eq("class_session_id", sess.id),
      ]);
      if (cancelled) return;

      // Teachers on the session: an explicit override, else the class's usual staff.
      const names = (list: any[] | null) => (list ?? []).map((r) => r.staff?.first_name || r.staff?.full_name).filter(Boolean) as string[];
      const explicitNames = names(explicit as any[]);
      setTeachers(explicitNames.length > 0 ? explicitNames : names(usual as any[]));

      // Who is actually on this date: standing places every week, dated
      // ones (trials, pay-as-you-go, passes) only on their own date.
      const onDate = ((rows as unknown as BookingRow[]) ?? []).filter((b) => bookingCountsOnDate(b.notes, sess.session_date));
      const parentIds = [...new Set(onDate.map((b) => b.parent_id).filter(Boolean))];
      const { data: profiles } = parentIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", parentIds)
        : { data: [] as any[] };
      if (cancelled) return;
      const profileMap = new Map(((profiles as any[]) ?? []).map((p) => [p.user_id, p]));
      setBookings(
        onDate
          .map((b) => ({ ...b, profiles: profileMap.get(b.parent_id) ?? null }))
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === "confirmed" ? -1 : 1;
            return dancerName(a).localeCompare(dancerName(b));
          }),
      );
      setAttendance(Object.fromEntries(((att as AttendanceRow[]) ?? []).map((a) => [a.booking_id, a])));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, reloadKey]);

  // Every booking paid in the same Stripe payment as this one, so the
  // breakdown can show the whole checkout.
  const paymentSiblings = (b: BookingRow): PaymentSibling[] => {
    const ref = paymentRefOf(b.notes);
    const group = ref ? bookings.filter((o) => paymentRefOf(o.notes) === ref) : [b];
    return group.map((o) => ({
      id: o.id,
      studentName: o.students ? `${o.students.first_name} ${o.students.last_name}` : "Adult",
      className: o.classes?.name ?? "Booking",
      plan: o.booking_type,
      amount: Number(o.amount ?? 0),
    }));
  };

  const confirmed = useMemo(() => bookings.filter((b) => b.status === "confirmed"), [bookings]);
  const arrived = useMemo(() => Object.values(attendance).filter((a) => a.checked_in_at && a.status !== "absent").length, [attendance]);
  const absent = useMemo(() => Object.values(attendance).filter((a) => a.status === "absent").length, [attendance]);
  const marked = arrived + absent;

  if (loading) {
    return <div className="p-4 text-muted-foreground md:p-8">Loading…</div>;
  }
  if (missing || !session) {
    return (
      <div className="p-4 md:p-8">
        <EmptyState
          title="That class session isn't here any more"
          body="It may have been deleted, or the link is out of date."
          action={<Button variant="outline" onClick={() => navigate("/admin")}>Back to the dashboard</Button>}
        />
      </div>
    );
  }

  const cls = session.classes;
  const cancelled = session.status === "cancelled";
  const isChildren = cls?.class_type === "children";
  const booked = confirmed.length;
  const quiet = !cancelled && booked < QUIET_CLASS_THRESHOLD;
  const capacity = cls?.capacity && cls.capacity > 0 ? cls.capacity : null;
  const spacesLeft = capacity != null ? Math.max(0, capacity - booked) : null;
  const dateLabel = format(parseISO(session.session_date), "EEEE d MMMM");
  const cancelNote = cancelled ? cancelNoteOf(session.notes) : null;
  const registerHref = `/admin/registers?date=${session.session_date}&session=${session.id}`;

  return (
    <div className="space-y-4 p-4 pb-28 md:space-y-6 md:p-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="pressable -ml-1 inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      {/* The class, this date, and what can be done to the whole session. */}
      <Card className={`overflow-hidden ${quiet ? "border-destructive/40" : ""}`}>
        <CardContent className="p-4 md:p-6">
          <p className="text-[13px] font-medium text-muted-foreground">
            {isChildren ? "Children's class" : "Adult class"}
            {cls?.venues?.name && ` · ${cls.venues.name}`}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className={`font-display text-2xl font-bold md:text-3xl ${cancelled ? "text-muted-foreground line-through" : ""}`}>
              {cls?.name ?? "Class"}
            </h1>
            {cancelled ? (
              <TonePill tone="destructive" className="mt-1.5">Cancelled</TonePill>
            ) : quiet ? (
              <TonePill tone="destructive" className="mt-1.5">Under {QUIET_CLASS_THRESHOLD} booked</TonePill>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {dateLabel}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTimeRange(session.start_time, session.end_time)}</span>
            {cls?.venues?.name && (
              <span className="hidden items-center gap-1 md:flex"><MapPin className="h-3.5 w-3.5" /> {cls.venues.name}</span>
            )}
            {teachers.length > 0 && (
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> with {teachers.join(" & ")}</span>
            )}
          </div>
          {cancelNote && (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-[hsl(var(--destructive-strong))]">{cancelNote}</p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-muted/50 px-3 py-2.5">
              <p className={`text-xl font-bold tabular-nums ${quiet ? "text-[hsl(var(--destructive-strong))]" : ""}`}>{booked}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Booked</p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-3 py-2.5">
              <p className="text-xl font-bold tabular-nums">{spacesLeft != null ? spacesLeft : "—"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {capacity != null ? `Spaces of ${capacity}` : "No limit"}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-3 py-2.5">
              <p className="text-xl font-bold tabular-nums">{marked > 0 ? arrived : "—"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {marked > 0 ? `Arrived · ${absent} absent` : "Not marked yet"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link to={registerHref}><ClipboardList className="mr-1.5 h-4 w-4" /> Open register</Link>
            </Button>
            <Button className="h-11 rounded-full" onClick={() => setAddOpen(true)} disabled={cancelled}>
              <Plus className="mr-1.5 h-4 w-4" /> Add booking
            </Button>
          </div>
          {!cancelled && (
            <Button
              variant="outline"
              className="mt-2 h-11 w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="mr-1.5 h-4 w-4" /> Cancel this class
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Everyone on the register for this date, with the usual actions. */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Who's booked · {bookings.length}
          </h2>
          {bookings.some((b) => b.status === "pending_payment") && (
            <span className="text-xs text-muted-foreground">
              {bookings.filter((b) => b.status === "pending_payment").length} awaiting payment
            </span>
          )}
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            title={cancelled ? "Nobody is booked on this date" : "Nobody booked yet"}
            body={cancelled ? "Bookings that were on it have been moved or cancelled." : "Put someone on by hand, or share the class page with families."}
            action={!cancelled ? <Button className="rounded-full" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add booking</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const att = attendance[b.id];
              const parent = b.profiles;
              const showParent = !!parent && !b.students?.is_self && parent.full_name !== dancerName(b);
              return (
                <Card key={b.id} className="animate-fade-in overflow-hidden">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-wrap items-start gap-3 md:items-center">
                      <div className="min-w-0 flex-1 basis-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{dancerName(b)}</span>
                          {b.status !== "confirmed" && <StatusPill status={b.status} />}
                          {att?.status === "absent" ? (
                            <TonePill tone="destructive">Absent</TonePill>
                          ) : att?.checked_in_at ? (
                            <TonePill tone="success">Arrived {format(new Date(att.checked_in_at), "HH:mm")}</TonePill>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {showParent ? parent!.full_name : parent?.email ?? "No account details"}
                          {showParent && parent?.phone && ` · ${parent.phone}`}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {planLabel(b.booking_type)} · booked {format(new Date(b.booked_at), "d MMM")}
                        </p>
                      </div>
                      {b.amount != null && Number(b.amount) > 0 && (
                        <span className="shrink-0 font-semibold tabular-nums">£{Number(b.amount).toFixed(2)}</span>
                      )}
                      {actions.breakdownId === b.id && (
                        <div className="order-3 basis-full md:order-4">
                          <BookingBreakdown booking={b as any} parent={parent} samePayment={paymentSiblings(b)} />
                        </div>
                      )}
                      <div className="order-4 basis-full md:order-3 md:ml-1 md:basis-auto">
                        <BookingActions booking={b} actions={actions} className="mt-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {dialogs}

      <CancelSessionSheet
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        sessionId={session.id}
        onCancelled={reload}
      />

      <AddBookingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={reload}
        preset={{ classId: session.class_id, sessionDate: session.session_date }}
      />
    </div>
  );
};

export default AdminClassSession;
