import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, differenceInYears, format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { AlertTriangle, Cake, CalendarDays, CameraOff, Check, LogIn, LogOut, MapPin, ScanLine, Search, Star, X, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Chip, ChipRow } from "@/components/booking/Chips";
import { DateStrip } from "@/components/booking/DateStrip";
import { EmptyState } from "@/components/booking/EmptyState";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { Bone } from "@/components/booking/Skeletons";
import { ListRowsSkeleton } from "@/components/booking/PortalSkeletons";
import StudentProfileDrawer from "@/components/staff/StudentProfileDrawer";
import QrScannerDialog from "@/components/staff/QrScannerDialog";
import FamilyCheckInSheet from "@/components/staff/FamilyCheckInSheet";
import { CollectorSheet } from "@/components/staff/CollectorSheet";
import { CancelSessionSheet } from "@/components/admin/CancelSessionSheet";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import { initialsOf } from "@/lib/initials";
import { birthdayInWeekOf, birthdayLabel } from "@/lib/birthdays";
import {
  REGISTER_DEPARTURES,
  arrivalOpensLabel,
  attendanceTarget,
  registerState,
  sessionArrivalsOpen,
  type RegisterState,
} from "@/lib/registerRules";
import { timetableStripDays } from "@/lib/timetableGaps";
import { formatTimeRange } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

/**
 * Whose registers the screen shows.
 *  - staff: the sessions this member teaches (explicit per-session
 *    assignments plus the classes they usually take, unless someone else
 *    has been assigned that session instead);
 *  - all: every class session and camp day — the studio's own view.
 */
export type RegisterScope = { kind: "staff"; staffId: string | null } | { kind: "all" };

/** How far the day strip reaches either side of today. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 14;

const CLASS_SELECT = `id, session_date, start_time, end_time, status, class_id, classes:class_id ( name, class_type, location_note, venue_id, venues:venue_id ( name ) )`;
const CLASS_SELECT_WITH_STAFF = `${CLASS_SELECT}, session_instructors ( staff:staff_id ( id, first_name, last_name, full_name ) )`;
const BOOKING_SELECT = `id, student_id, parent_id, notes, students:student_id ( first_name, last_name, preferred_name, profile_photo, avatar_url, date_of_birth, is_self, has_send, has_epipen, has_inhaler, allergies_list, medical_conditions_list, medical_info, photo_consent )`;

interface RegisterSession {
  id: string;
  kind: "class" | "camp";
  class_id: string | null;
  camp_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  /** 'scheduled' normally; 'cancelled' when the studio has called it off. */
  status?: string | null;
  classes: {
    name: string | null;
    class_type?: string | null;
    location_note?: string | null;
    venue_id?: string | null;
    venues?: { name: string } | null;
  } | null;
  instructors: { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null }[];
}

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const firstNameOf = (st: { first_name?: string | null; full_name?: string | null }) =>
  st.first_name || st.full_name?.split(" ")[0] || "";

const TONE: Record<RegisterState, { row: string; label: string }> = {
  unaccounted: { row: "", label: "Not marked" },
  in: { row: "bg-success/10", label: "In" },
  out: { row: "bg-primary/10", label: "Departed" },
  absent: { row: "bg-destructive/10", label: "Absent" },
};

/**
 * The register at the door, as an app: pick the day, see each class with
 * everyone booked on it, tap a name for everything you need to know, and
 * mark them in or out with one thumb. Rows change colour as they're marked.
 * The same screen serves a teacher (their classes) and the studio (every
 * class and event, with a venue switch and any date).
 */
export function RegisterScreen({ scope }: { scope: RegisterScope }) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const showAll = scope.kind === "all";
  const staffId = scope.kind === "staff" ? scope.staffId : null;

  // Local date, not UTC — toISOString() opens yesterday's register after 11pm BST.
  const today = format(new Date(), "yyyy-MM-dd");
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const setDate = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === today) params.delete("date");
    else params.set("date", next);
    setSearchParams(params, { replace: true });
  };

  // Every session in the strip's window; the day's sessions are a slice of it.
  const [windowSessions, setWindowSessions] = useState<RegisterSession[]>([]);
  const [windowLoaded, setWindowLoaded] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  /** Show one class on its own — at the door you want the group in front of you. */
  const [classFilter, setClassFilter] = useState<string>("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [profileBooking, setProfileBooking] = useState<{ booking: any; sessionId: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [collectorPrompt, setCollectorPrompt] = useState<{ booking: any; sessionId: string; method: "qr" | "manual" } | null>(null);
  const [collectorName, setCollectorName] = useState("");
  // The studio's emergency button: cancel a class from the door.
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  // A scanned family QR opens this sheet — one scan covers every attendee the
  // parent booked on the class; nothing is marked until staff tap the buttons.
  const [familySheet, setFamilySheet] = useState<{ sessionId: string; parentId: string; parentName: string | null } | null>(null);

  // The arrival window is judged against the clock; keep it fresh.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Sheets portal to <body>; carry the product typography with them.
  useEffect(() => {
    document.body.classList.add("portal-ui");
    return () => document.body.classList.remove("portal-ui");
  }, []);

  const windowStart = useMemo(() => {
    const s = format(addDays(new Date(), -DAYS_BACK), "yyyy-MM-dd");
    return date < s ? date : s;
  }, [date]);
  const windowEnd = useMemo(() => {
    const e = format(addDays(new Date(), DAYS_AHEAD), "yyyy-MM-dd");
    return date > e ? date : e;
  }, [date]);

  // ── Sessions across the window ─────────────────────────────────────────
  useEffect(() => {
    if (!showAll && !staffId) return;
    let cancelled = false;
    (async () => {
      setWindowLoaded(false);
      const found = showAll ? await loadAllSessions(windowStart, windowEnd) : await loadStaffSessions(staffId!, windowStart, windowEnd);
      if (cancelled) return;
      setWindowSessions(found);
      setWindowLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [showAll, staffId, windowStart, windowEnd]);

  const daySessions = useMemo(
    () => windowSessions
      .filter((s) => s.session_date === date)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    [windowSessions, date],
  );

  // Venue switch for the day — only venues that actually have a register.
  const venueOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const s of daySessions) {
      if (s.classes?.venue_id && s.classes?.venues?.name) byId.set(s.classes.venue_id, s.classes.venues.name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [daySessions]);

  // A venue chosen on one day may not run on the next; fall back to all.
  useEffect(() => {
    if (venueFilter !== "all" && !venueOptions.some((v) => v.id === venueFilter)) setVenueFilter("all");
  }, [venueOptions, venueFilter]);

  const venueSessions = useMemo(
    () => (venueFilter === "all" ? daySessions : daySessions.filter((s) => s.classes?.venue_id === venueFilter)),
    [daySessions, venueFilter],
  );

  const sessions = useMemo(
    () => (classFilter === "all" ? venueSessions : venueSessions.filter((s) => s.id === classFilter)),
    [venueSessions, classFilter],
  );

  // The class picked yesterday isn't on today's list; fall back to all.
  useEffect(() => {
    if (classFilter !== "all" && !venueSessions.some((s) => s.id === classFilter)) setClassFilter("all");
  }, [venueSessions, classFilter]);

  const stripDays = useMemo(
    () => timetableStripDays(
      windowSessions.filter((s) => s.status !== "cancelled").map((s) => s.session_date),
      windowStart,
      windowEnd,
    ).map((d) => ({ ...d, disabled: false })),
    [windowSessions, windowStart, windowEnd],
  );

  useEffect(() => {
    if (!windowLoaded) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowLoaded, date, windowSessions]);

  // ── Bookings + attendance per session, the register's rows ─────────────
  const load = async () => {
    setLoading(true);
    const entries = await Promise.all(daySessions.map(async (s) => {
      // A cancelled class has no register: nobody is expected, nothing to mark.
      if (s.status === "cancelled") return [s.id, [] as any[]] as const;
      const isCamp = s.kind === "camp";
      const [{ data: bookings }, { data: att }, { data: unpaidRows }] = await Promise.all([
        isCamp
          ? supabase.from("bookings").select(BOOKING_SELECT).eq("camp_id", s.camp_id!).eq("status", "confirmed")
          : supabase.from("bookings").select(BOOKING_SELECT).eq("class_id", s.class_id!).eq("status", "confirmed"),
        supabase.from("attendance").select("*").eq(isCamp ? "camp_session_id" : "class_session_id", s.id),
        // Families whose monthly membership payment has failed — flagged on
        // the register so the door team can catch non-payers. Camps are paid
        // up front, so there's nothing to flag there.
        isCamp
          ? Promise.resolve({ data: [] as any[] })
          : supabase.rpc("get_unpaid_membership_attendees", { _class_id: s.class_id! }),
      ]);
      const unpaidStudents = new Set((unpaidRows ?? []).map((u: any) => u.student_id).filter(Boolean));
      const unpaidParents = new Set((unpaidRows ?? []).filter((u: any) => !u.student_id).map((u: any) => u.user_id));
      const attByBooking: Record<string, any> = {};
      (att ?? []).forEach((a: any) => (attByBooking[a.booking_id] = a));
      // Pass/birthday bookings are per-session (the date is in their notes) —
      // only show them on the register for their own date. Class-level
      // bookings (memberships, trials, drop-ins) appear every week.
      const rows = ((bookings ?? []) as any[])
        .filter((b) => {
          const m = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes || "");
          return !m || m[1] === s.session_date;
        })
        .map((b) => ({
          ...b,
          attendance: attByBooking[b.id] || null,
          unpaid: unpaidStudents.has(b.student_id) || (!b.student_id && unpaidParents.has(b.parent_id)),
        }))
        // Registers read top-to-bottom at the door, so keep them alphabetical;
        // rows with no attendee profile sink to the bottom.
        .sort((a, b) => {
          const an = a.students ? `${a.students.first_name} ${a.students.last_name}`.toLowerCase() : null;
          const bn = b.students ? `${b.students.first_name} ${b.students.last_name}`.toLowerCase() : null;
          if (an === null) return bn === null ? 0 : 1;
          if (bn === null) return -1;
          return an.localeCompare(bn);
        });
      return [s.id, rows] as const;
    }));
    setAttendance(Object.fromEntries(entries));
    setLoading(false);
  };

  const sessionById = (id: string) => windowSessions.find((s) => s.id === id) ?? null;

  const writeFailed = (error: { message: string } | null) => {
    if (!error) return false;
    toast({ title: "Couldn't update register", description: error.message, variant: "destructive" });
    return true;
  };

  // Attendance rows apply to adult self-bookings too — student_id may be null
  // on legacy adult bookings, which is valid (the column is nullable).
  const markAbsent = async (session: RegisterSession, booking: any) => {
    const target = attendanceTarget(session);
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id,
      ...target.keys,
      student_id: booking.student_id ?? null,
      session_date: session.session_date,
      status: "absent",
      checked_in_at: null,
      checked_out_at: null,
    } as any, { onConflict: target.onConflict });
    if (writeFailed(error)) return;
    toast({ title: "Marked absent" });
    void load();
  };

  const clearAttendance = async (booking: any) => {
    if (!booking.attendance) return;
    // UPDATE, not DELETE — staff RLS has no delete policy, so a delete
    // silently matches nothing. Resetting to 'expected' renders as Unaccounted.
    const { error } = await supabase.from("attendance").update({
      status: "expected",
      checked_in_at: null,
      checked_out_at: null,
      check_in_method: null,
      check_out_method: null,
      collector_name: null,
    }).eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Status cleared" });
    void load();
  };

  const performCheckIn = async (booking: any, session: RegisterSession, method: "qr" | "manual", collector: string | null) => {
    const target = attendanceTarget(session);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id,
      ...target.keys,
      student_id: booking.student_id ?? null,
      session_date: session.session_date,
      status: "present",
      checked_in_at: nowIso,
      checked_out_at: null,
      check_in_method: method,
      collector_name: collector,
    } as any, { onConflict: target.onConflict });
    if (writeFailed(error)) return;
    toast({ title: "Checked in", description: collector ? `Dropped off by ${collector}` : undefined });
    void load();
  };

  // "Dancer of the Week" tick (Class4kids-style) — stored on the attendance
  // row so it lives in the register history for that session.
  const toggleDancerOfWeek = async (session: RegisterSession, booking: any) => {
    const next = !booking.attendance?.dancer_of_week;
    const target = attendanceTarget(session);
    const { error } = booking.attendance
      ? await supabase.from("attendance").update({ dancer_of_week: next } as any).eq("id", booking.attendance.id)
      : await supabase.from("attendance").insert({
          booking_id: booking.id,
          ...target.keys,
          student_id: booking.student_id ?? null,
          session_date: session.session_date,
          status: "expected",
          dancer_of_week: true,
        } as any);
    if (writeFailed(error)) return;
    toast({ title: next ? "Dancer of the Week ⭐" : "Dancer of the Week removed" });
    void load();
  };

  const performCheckOut = async (booking: any, method: "qr" | "manual", collector: string | null) => {
    if (!booking.attendance) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("attendance").update({
      checked_out_at: nowIso,
      check_out_method: method,
      collector_name: collector ?? booking.attendance.collector_name,
    }).eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Checked out", description: collector ? `Collected by ${collector}` : undefined });
    void load();
  };

  // Manual marks ask for the collector's name first (optional) — only while
  // departures are recorded; with arrivals alone, Arrived is one tap.
  const beginManualMark = (sessionId: string, booking: any) => {
    if (!REGISTER_DEPARTURES) {
      const session = sessionById(sessionId);
      if (session) void performCheckIn(booking, session, "manual", null);
      return;
    }
    setCollectorName("");
    setCollectorPrompt({ booking, sessionId, method: "manual" });
  };

  const submitCollectorPrompt = async (name: string | null) => {
    if (!collectorPrompt) return;
    const { booking, sessionId, method } = collectorPrompt;
    const session = sessionById(sessionId);
    const isCheckOut = !!booking.attendance?.checked_in_at && !booking.attendance?.checked_out_at;
    setCollectorPrompt(null);
    if (isCheckOut) await performCheckOut(booking, method, name);
    else if (session) await performCheckIn(booking, session, method, name);
  };

  // Scanner result → look up token and open the family sheet
  const handleScannedToken = async (token: string) => {
    setScannerOpen(false);
    const { data: t } = await supabase
      .from("booking_qr_tokens")
      .select("booking_id, valid_until")
      .eq("token", token)
      .maybeSingle();
    if (!t) {
      toast({ title: "Code not recognised", description: "Ask the parent to refresh their QR code.", variant: "destructive" });
      return;
    }
    if (new Date(t.valid_until) < new Date()) {
      toast({ title: "Code expired", description: "Ask the parent to open a fresh code.", variant: "destructive" });
      return;
    }
    // Find which of the day's sessions this booking belongs to.
    let matchSessionId: string | null = null;
    let matchBooking: any = null;
    for (const [sessionId, rows] of Object.entries(attendance)) {
      const found = (rows as any[]).find((b) => b.id === t.booking_id);
      if (found) {
        matchSessionId = sessionId;
        matchBooking = found;
        break;
      }
    }
    if (!matchSessionId || !matchBooking) {
      toast({
        title: "Not on this day's register",
        description: "This QR is valid, but the booking isn't scheduled in any class on this date.",
        variant: "destructive",
      });
      return;
    }

    // One family QR covers every attendee this parent booked on the class.
    // Never auto-mark — open the check-in sheet so staff choose per person.
    let parentName: string | null = null;
    if (matchBooking.parent_id) {
      const { data: parent } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", matchBooking.parent_id)
        .maybeSingle();
      parentName = parent?.full_name ?? null;
    }
    setFamilySheet({ sessionId: matchSessionId, parentId: matchBooking.parent_id, parentName });
  };

  // ── Presentation ──────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const matches = (b: any) => {
    if (!q) return true;
    const s = b.students;
    const hay = s ? `${s.first_name} ${s.last_name} ${s.preferred_name ?? ""}`.toLowerCase() : "adult attendee";
    return hay.includes(q);
  };

  const dayLabel = (() => {
    const d = parseISO(date);
    const rel = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : isYesterday(d) ? "Yesterday" : format(d, "EEEE");
    return { rel, long: format(d, "d MMMM yyyy") };
  })();
  const dayWord =
    dayLabel.rel === "Today" ? "today"
      : dayLabel.rel === "Tomorrow" ? "tomorrow"
        : dayLabel.rel === "Yesterday" ? "yesterday"
          : `on ${dayLabel.rel}`;

  const dayTotals = sessions.reduce(
    (acc, s) => {
      for (const b of attendance[s.id] ?? []) acc[registerState(b.attendance)]++;
      return acc;
    },
    { unaccounted: 0, in: 0, out: 0, absent: 0 } as Record<RegisterState, number>,
  );

  const profileSession = profileBooking ? sessionById(profileBooking.sessionId) : null;
  const venueLine = (s: RegisterSession) => s.classes?.venues?.name || s.classes?.location_note || "Venue TBC";
  const ready = windowLoaded && !loading;

  return (
    <div className="app-screen portal-ui min-h-[100dvh] bg-background pb-28">
      {/* Day picker — stays put while the register scrolls */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Registers</h1>
              <p className="text-[13px] text-muted-foreground">
                {dayLabel.rel} · {dayLabel.long}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {ready && sessions.length > 0 && (
                <p className="text-right text-[13px] tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{dayTotals.in + dayTotals.out}</span> of {dayTotals.unaccounted + dayTotals.in + dayTotals.out + dayTotals.absent} in
                </p>
              )}
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                aria-label="Pick a date"
                className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground hover:border-foreground/40"
              >
                <CalendarDays className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          {stripDays.length > 0 ? (
            <DateStrip className="mt-3" days={stripDays} value={date} onChange={setDate} relativeLabels />
          ) : (
            <div className="mt-3 flex gap-2 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <Bone key={i} className="h-[68px] w-[54px] shrink-0 rounded-2xl" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {/* Which venue — only when the day runs at more than one */}
        {ready && venueOptions.length > 1 && (
          <ChipRow>
            <Chip selected={venueFilter === "all"} onClick={() => setVenueFilter("all")}>
              <MapPin className="h-4 w-4" aria-hidden /> All venues
            </Chip>
            {venueOptions.map((v) => (
              <Chip key={v.id} selected={venueFilter === v.id} onClick={() => setVenueFilter(v.id)}>
                {v.name}
              </Chip>
            ))}
          </ChipRow>
        )}

        {/* Jump straight to the class in front of you */}
        {ready && venueSessions.length > 1 && (
          <ChipRow>
            <Chip selected={classFilter === "all"} onClick={() => setClassFilter("all")}>
              All classes
            </Chip>
            {venueSessions.map((s) => (
              <Chip key={s.id} selected={classFilter === s.id} onClick={() => setClassFilter(s.id)}>
                {String(s.start_time).slice(0, 5)} {s.classes?.name ?? "Class"}
              </Chip>
            ))}
          </ChipRow>
        )}

        {/* Find a name across the day's classes */}
        {ready && sessions.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              aria-label="Find a dancer"
              placeholder="Find a dancer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 rounded-xl pl-10 pr-10 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {!ready ? (
          <div className="space-y-4">
            <div className="surface p-4">
              <Bone className="h-5 w-40" />
              <Bone className="mt-2 h-3.5 w-56" />
            </div>
            <ListRowsSkeleton rows={6} />
          </div>
        ) : daySessions.length === 0 ? (
          showAll ? (
            <EmptyState
              title={`No classes ${dayWord}`}
              body="Nothing is scheduled on this date. Pick another day above, or use the calendar for a past register."
            />
          ) : (
            <EmptyState
              title={`No classes for you ${dayWord}`}
              body="Pick another day above. Classes appear here once you're assigned to them."
            />
          )
        ) : sessions.length === 0 ? (
          <EmptyState
            title="Nothing at this venue"
            body="No classes run here on this date. Switch venue above."
            action={<Button type="button" variant="outline" className="rounded-full" onClick={() => setVenueFilter("all")}>Show all venues</Button>}
          />
        ) : (
          sessions.map((s) => {
            const rows = (attendance[s.id] || []) as any[];
            const visible = rows.filter(matches);
            const open = sessionArrivalsOpen(s, now);
            const opensLabel = open ? null : arrivalOpensLabel(s.session_date, s.start_time, now);
            const totals = rows.reduce(
              (acc, b) => { acc[registerState(b.attendance)]++; return acc; },
              { unaccounted: 0, in: 0, out: 0, absent: 0 } as Record<RegisterState, number>,
            );
            const sessionLabel = `${s.classes?.name ?? "Class"} · ${formatTimeRange(s.start_time, s.end_time)}`;
            const teachers = showAll ? s.instructors.map(firstNameOf).filter(Boolean).join(", ") : "";
            const cancelled = s.status === "cancelled";
            return (
              <section key={s.id} className={cn("surface overflow-hidden", cancelled && "opacity-80")} aria-label={cancelled ? `${sessionLabel} (cancelled)` : sessionLabel}>
                <header className={cn("px-4 py-3", !cancelled && "border-b border-border/70")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className={cn("flex items-center gap-2 text-[17px] font-semibold", cancelled ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground")}>
                        <span className="truncate">{s.classes?.name ?? (s.kind === "camp" ? "Event" : "Class")}</span>
                        {s.kind === "camp" && (
                          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide no-underline text-[hsl(var(--warning-strong))]">Event</span>
                        )}
                      </h2>
                      <p className="text-[13px] text-muted-foreground">
                        {formatTimeRange(s.start_time, s.end_time)} · {venueLine(s)}{teachers ? ` · with ${teachers}` : ""}
                      </p>
                    </div>
                    {cancelled ? (
                      <span className="shrink-0 rounded-full bg-destructive/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--destructive-strong))]">Cancelled</span>
                    ) : (
                      <p className="shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">
                        <span className="text-[17px] font-semibold text-foreground">{totals.in + totals.out}</span>/{rows.length}
                      </p>
                    )}
                  </div>
                  {cancelled && (
                    <p className="mt-1.5 text-[13px] text-muted-foreground">This class isn't running today — nothing to mark.</p>
                  )}
                  {showAll && !cancelled && s.kind === "class" && (
                    <button
                      type="button"
                      onClick={() => setCancelSessionId(s.id)}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[12px] font-semibold text-muted-foreground hover:border-destructive/50 hover:text-[hsl(var(--destructive-strong))]"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden /> Cancel this class
                    </button>
                  )}
                  {!cancelled && rows.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold">
                      {totals.unaccounted > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{totals.unaccounted} to come</span>}
                      {totals.in > 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[hsl(var(--success-strong))]">{totals.in} in</span>}
                      {totals.out > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{totals.out} out</span>}
                      {totals.absent > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[hsl(var(--destructive-strong))]">{totals.absent} absent</span>}
                    </div>
                  )}
                  {!cancelled && opensLabel && (
                    <p className="mt-2 text-[13px] text-warning">Arrivals {opensLabel.toLowerCase().replace(/^opens/, "open")} — 15 minutes before the class.</p>
                  )}
                </header>

                {cancelled ? null : rows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[15px] text-muted-foreground">No bookings yet for this {s.kind === "camp" ? "event" : "class"}.</p>
                ) : visible.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[15px] text-muted-foreground">No one matching “{query}” in this {s.kind === "camp" ? "event" : "class"}.</p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {visible.map((b: any) => {
                      const att = b.attendance;
                      const state = registerState(att);
                      const tone = TONE[state];
                      const student = b.students;
                      const age = student?.date_of_birth ? differenceInYears(new Date(), new Date(student.date_of_birth)) : null;
                      const hasMedical = !!(
                        student?.has_epipen || student?.has_inhaler ||
                        student?.allergies_list?.length || student?.medical_conditions_list?.length ||
                        student?.medical_info
                      );
                      const hasUrgent = student?.has_epipen || student?.has_inhaler;
                      const name = student
                        ? `${student.preferred_name || student.first_name} ${student.last_name}`
                        : "Adult attendee";
                      const bd = student?.date_of_birth ? birthdayInWeekOf(student.date_of_birth, s.session_date) : null;
                      const statusLine =
                        state === "absent"
                          ? "Absent"
                          : state === "out"
                            ? `In ${fmtTime(att.checked_in_at)} · Out ${fmtTime(att.checked_out_at)}${att.collector_name ? ` · ${att.collector_name}` : ""}`
                            : state === "in"
                              ? `In ${fmtTime(att.checked_in_at)}${att.collector_name ? ` · ${att.collector_name}` : ""}`
                              : "Not marked";
                      const openProfile = () => setProfileBooking({ booking: b, sessionId: s.id });
                      return (
                        <li key={b.id} className={cn("flex items-center gap-2 py-2 pl-3 pr-2 transition-colors", tone.row)}>
                          <button
                            type="button"
                            onClick={openProfile}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`${name}, ${tone.label}. Open details`}
                          >
                            <PhotoAvatarDuo
                              photoUrl={student?.profile_photo}
                              avatarUrl={student?.avatar_url}
                              initials={initialsOf(student?.first_name, student?.last_name)}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[15px] font-semibold text-foreground">{name}</span>
                                {att?.dancer_of_week && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" aria-label="Dancer of the Week" />}
                                {hasUrgent ? (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="EpiPen or inhaler" />
                                ) : hasMedical ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-label="Medical notes" />
                                ) : null}
                                {bd && <Cake className={cn("h-3.5 w-3.5 shrink-0", bd === "today" ? "text-accent" : "text-accent/60")} aria-label={bd === "today" ? "Birthday today" : `Birthday ${birthdayLabel(student.date_of_birth, s.session_date)}`} />}
                                {student && student.photo_consent === false && <CameraOff className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="No photo consent" />}
                              </span>
                              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                                {[age != null ? `${age}y` : null, statusLine].filter(Boolean).join(" · ")}
                              </span>
                              {(b.unpaid || student?.has_send || student?.is_self || !student) && (
                                <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide">
                                  {b.unpaid && <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[hsl(var(--destructive-strong))]">Unpaid</span>}
                                  {student?.has_send && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[hsl(var(--warning-strong))]">SEND</span>}
                                  {student?.is_self && <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">Adult</span>}
                                  {!student && <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">No profile</span>}
                                </span>
                              )}
                            </span>
                          </button>

                          {/* The one next step, under the thumb */}
                          <div className="shrink-0">
                            {state === "unaccounted" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={!open}
                                onClick={() => beginManualMark(s.id, b)}
                                aria-label={open ? `Mark ${name} arrived` : `Arrivals ${opensLabel?.toLowerCase()}`}
                                className="h-10 rounded-full bg-success px-3.5 text-[14px] font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-40"
                              >
                                <LogIn className="h-4 w-4" /> Arrived
                              </Button>
                            )}
                            {state === "in" && !REGISTER_DEPARTURES && (
                              <button
                                type="button"
                                onClick={openProfile}
                                aria-label={`${name} arrived. Open details`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-[hsl(var(--success-strong))]"
                              >
                                <Check className="h-5 w-5" strokeWidth={2.5} />
                              </button>
                            )}
                            {state === "in" && REGISTER_DEPARTURES && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => beginManualMark(s.id, b)}
                                aria-label={`Mark ${name} departed`}
                                className="h-10 rounded-full bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
                              >
                                <LogOut className="h-4 w-4" /> Departed
                              </Button>
                            )}
                            {state === "out" && (
                              <button
                                type="button"
                                onClick={openProfile}
                                aria-label={`${name} departed. Open details`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary"
                              >
                                <Check className="h-5 w-5" strokeWidth={2.5} />
                              </button>
                            )}
                            {state === "absent" && (
                              <button
                                type="button"
                                onClick={openProfile}
                                className="inline-flex h-10 items-center rounded-full bg-destructive/15 px-3.5 text-[13px] font-semibold text-[hsl(var(--destructive-strong))]"
                              >
                                Absent
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Scan — always a thumb away */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:left-64">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <Button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <ScanLine className="h-5 w-5" /> Scan a family's QR code
          </Button>
        </div>
      </div>

      {/* Any date — past registers included */}
      <ResponsiveSheet
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        title="Pick a date"
        description="Past registers stay as they were marked."
        footer={
          date !== today ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl text-base"
              onClick={() => { setDate(today); setDatePickerOpen(false); }}
            >
              Back to today
            </Button>
          ) : undefined
        }
      >
        <div className="flex justify-center pb-2">
          <Calendar
            mode="single"
            selected={parseISO(date)}
            defaultMonth={parseISO(date)}
            onSelect={(d) => {
              if (!d) return;
              setDate(format(d, "yyyy-MM-dd"));
              setDatePickerOpen(false);
            }}
            initialFocus
          />
        </div>
      </ResponsiveSheet>

      <StudentProfileDrawer
        open={!!profileBooking}
        onOpenChange={(o) => !o && setProfileBooking(null)}
        studentId={profileBooking?.booking?.student_id ?? null}
        booking={profileBooking?.booking ?? null}
        sessionId={profileBooking?.sessionId ?? null}
        classId={profileSession?.class_id ?? null}
        // The 15-minute arrival rule applies to class sessions; camps have no timed rule.
        sessionDate={profileSession && profileSession.kind === "class" ? profileSession.session_date : null}
        sessionStart={profileSession && profileSession.kind === "class" ? profileSession.start_time : null}
        sessionLabel={profileSession ? `${profileSession.classes?.name ?? "Class"} · ${formatTimeRange(profileSession.start_time, profileSession.end_time)}` : null}
        onCheckIn={() => {
          if (!profileBooking) return;
          beginManualMark(profileBooking.sessionId, profileBooking.booking);
          setProfileBooking(null);
        }}
        onCheckOut={REGISTER_DEPARTURES ? () => {
          if (!profileBooking) return;
          beginManualMark(profileBooking.sessionId, profileBooking.booking);
          setProfileBooking(null);
        } : undefined}
        onMarkAbsent={() => {
          if (!profileBooking || !profileSession) return;
          void markAbsent(profileSession, profileBooking.booking);
          setProfileBooking(null);
        }}
        onClearAttendance={() => {
          if (!profileBooking) return;
          void clearAttendance(profileBooking.booking);
          setProfileBooking(null);
        }}
        onToggleDancerOfWeek={() => {
          if (!profileBooking || !profileSession) return;
          void toggleDancerOfWeek(profileSession, profileBooking.booking);
          setProfileBooking(null);
        }}
      />

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanned={handleScannedToken}
      />

      {(() => {
        if (!familySheet) return null;
        const session = sessionById(familySheet.sessionId);
        // Live rows from register state — statuses refresh as staff mark people.
        const rows = (attendance[familySheet.sessionId] || []).filter(
          (b: any) => b.parent_id === familySheet.parentId,
        );
        const open = session ? sessionArrivalsOpen(session, now) : true;
        return (
          <FamilyCheckInSheet
            open={!!familySheet}
            onOpenChange={(o) => !o && setFamilySheet(null)}
            className={session?.classes?.name ?? "Class"}
            sessionTime={session ? formatTimeRange(session.start_time, session.end_time) : ""}
            parentName={familySheet.parentName}
            rows={rows}
            departures={REGISTER_DEPARTURES}
            arrivalsOpen={open}
            arrivalsOpenLabel={session && !open ? arrivalOpensLabel(session.session_date, session.start_time, now) : null}
            onMarkArrived={(b) => { if (session) void performCheckIn(b, session, "qr", null); }}
            onMarkDeparted={(b) => void performCheckOut(b, "qr", null)}
          />
        );
      })()}

      {showAll && (
        <CancelSessionSheet
          open={!!cancelSessionId}
          onOpenChange={(o) => !o && setCancelSessionId(null)}
          sessionId={cancelSessionId}
          onCancelled={({ sessionId }) => {
            // The rows reload from the window list, so flipping the status
            // here is enough for the register to show it as cancelled.
            setWindowSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status: "cancelled" } : s)));
          }}
        />
      )}

      <CollectorSheet
        open={!!collectorPrompt}
        onOpenChange={(o) => !o && setCollectorPrompt(null)}
        mode={collectorPrompt?.booking?.attendance?.checked_in_at && !collectorPrompt?.booking?.attendance?.checked_out_at ? "out" : "in"}
        attendeeName={
          collectorPrompt?.booking?.students
            ? `${collectorPrompt.booking.students.preferred_name || collectorPrompt.booking.students.first_name} ${collectorPrompt.booking.students.last_name}`
            : "Adult attendee"
        }
        value={collectorName}
        onChange={setCollectorName}
        onConfirm={(name) => void submitCollectorPrompt(name)}
      />
    </div>
  );
}

// ── Session loading ──────────────────────────────────────────────────────

/** Sessions this member teaches across the window: explicit per-session
 *  assignments plus the classes they usually take, unless another member
 *  has been assigned that session instead. */
async function loadStaffSessions(staffId: string, windowStart: string, windowEnd: string): Promise<RegisterSession[]> {
  const { data: explicit } = await supabase
    .from("session_instructors")
    .select(`class_sessions!inner ( ${CLASS_SELECT} )`)
    .eq("staff_id", staffId);

  const { data: classAssignments } = await supabase
    .from("class_instructors")
    .select("class_id")
    .eq("staff_id", staffId);

  let defaults: any[] = [];
  const classIds = (classAssignments ?? []).map((c) => c.class_id);
  if (classIds.length > 0) {
    const { data } = await supabase
      .from("class_sessions")
      .select(CLASS_SELECT)
      .in("class_id", classIds)
      .gte("session_date", windowStart)
      .lte("session_date", windowEnd);
    const ids = (data ?? []).map((s) => s.id);
    const { data: overrides } = ids.length
      ? await supabase.from("session_instructors").select("session_id").in("session_id", ids)
      : { data: [] as any[] };
    const overrideIds = new Set((overrides ?? []).map((o: any) => o.session_id));
    defaults = (data ?? []).filter((s) => !overrideIds.has(s.id));
  }

  const byId = new Map<string, RegisterSession>();
  for (const s of [...((explicit ?? []).map((r: any) => r.class_sessions)), ...defaults]) {
    if (!s || s.session_date < windowStart || s.session_date > windowEnd) continue;
    byId.set(s.id, { ...s, kind: "class", camp_id: null, instructors: [] });
  }
  return [...byId.values()];
}

/** Every class session and camp day in the window, with who is teaching. */
async function loadAllSessions(windowStart: string, windowEnd: string): Promise<RegisterSession[]> {
  const [{ data: classRows }, { data: campRows }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(CLASS_SELECT_WITH_STAFF)
      .gte("session_date", windowStart)
      .lte("session_date", windowEnd),
    supabase
      .from("camp_sessions")
      .select("id, camp_id, session_date, start_time, end_time, status, camps:camp_id ( id, name, venue_id, is_active, venues:venue_id ( name ) )")
      .gte("session_date", windowStart)
      .lte("session_date", windowEnd)
      .neq("status", "cancelled"),
  ]);

  // Default class instructors where no per-session override exists.
  const rows = (classRows ?? []) as any[];
  const classIds = Array.from(new Set(rows.map((r) => r.class_id).filter(Boolean)));
  const defaultByClass: Record<string, any[]> = {};
  if (classIds.length > 0) {
    const { data: ci } = await supabase
      .from("class_instructors")
      .select("class_id, staff:staff_id ( id, first_name, last_name, full_name )")
      .in("class_id", classIds);
    (ci as any[] | null)?.forEach((c) => {
      defaultByClass[c.class_id] = defaultByClass[c.class_id] || [];
      if (c.staff) defaultByClass[c.class_id].push(c.staff);
    });
  }
  const classSessions: RegisterSession[] = rows.map((s) => {
    const explicit = (s.session_instructors ?? []).map((si: any) => si.staff).filter(Boolean);
    const { session_instructors: _si, ...rest } = s;
    return { ...rest, kind: "class", camp_id: null, instructors: explicit.length > 0 ? explicit : (defaultByClass[s.class_id] ?? []) };
  });

  // Camp days sit alongside the class registers, shaped like class sessions
  // so everything downstream — venue chips, headers, rows — works on both.
  const activeCampRows = ((campRows as any[]) ?? []).filter((c) => c.camps?.is_active !== false);
  const campIds = Array.from(new Set(activeCampRows.map((c) => c.camp_id)));
  const campStaffByCamp: Record<string, any[]> = {};
  if (campIds.length > 0) {
    const { data: ci } = await supabase
      .from("camp_instructors")
      .select("camp_id, staff:staff_id ( id, first_name, last_name, full_name )")
      .in("camp_id", campIds);
    (ci as any[] | null)?.forEach((c) => {
      campStaffByCamp[c.camp_id] = campStaffByCamp[c.camp_id] || [];
      if (c.staff) campStaffByCamp[c.camp_id].push(c.staff);
    });
  }
  const campSessions: RegisterSession[] = activeCampRows.map((c) => ({
    id: c.id,
    kind: "camp",
    camp_id: c.camp_id,
    class_id: null,
    session_date: c.session_date,
    start_time: c.start_time,
    end_time: c.end_time,
    classes: {
      name: c.camps?.name ?? "Event",
      class_type: null,
      location_note: null,
      venue_id: c.camps?.venue_id ?? null,
      venues: c.camps?.venues ?? null,
    },
    instructors: campStaffByCamp[c.camp_id] ?? [],
  }));

  return [...classSessions, ...campSessions];
}

export default RegisterScreen;
