import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";
import { SectionHeading } from "@/components/booking/SectionHeading";
import { DateStrip } from "@/components/booking/DateStrip";
import { EmptyState } from "@/components/booking/EmptyState";
import { QuietNotice } from "@/components/booking/QuietNotice";
import { Bone } from "@/components/booking/Skeletons";
import { ListRowsSkeleton } from "@/components/booking/PortalSkeletons";
import { SessionRow } from "@/components/booking/SessionRow";
import { VenuePicker, type VenueOption } from "@/components/booking/VenuePicker";
import { timetableStripDays } from "@/lib/timetableGaps";
import { classLinkPath } from "@/lib/classLinks";

interface TimetableClass {
  id: string;
  name: string;
  class_type: "children" | "adult";
  dance_style: string | null;
  venue_id: string | null;
  venues: { name: string; city: string | null } | null;
}

interface SessionRow {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

interface MembershipRow {
  id: string;
  class_id: string | null;
  student_id: string | null;
  status: string;
  students: { first_name: string; preferred_name: string | null } | null;
}

interface PassRow {
  id: string;
  pass_type: string;
  sessions_remaining: number;
  expires_at: string;
}

/** Membership statuses that still cover class attendance. */
const VALID_MEMBERSHIP_STATUSES = ["active", "past_due", "paused", "cancel_scheduled"];

/** How far ahead the timetable looks. */
const HORIZON_DAYS = 21;

/** Members' timetable: a dated list of upcoming sessions across venues, with
 *  per-row actions resolved from the member's own memberships and passes.
 *  Bookings ride the existing paths only — membership (already covered),
 *  pass redemption (PassRedeemDialog → redeem-pass), or the class browser. */
const Timetable = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [venueId, setVenueId] = useState<string>("all");
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  /** The dates the session query covered — the day strip spans exactly this. */
  const [windowRange, setWindowRange] = useState<{ start: string; end: string } | null>(null);
  /** Set when the next session is beyond the normal horizon (holiday break):
   *  the date classes come back, shown as a banner over next term's timetable. */
  const [backOn, setBackOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  // Day strip: one day at a time by default; "Show all days" lists the whole window.
  const [dayMode, setDayMode] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Venues for the picker — only venues that actually host a bookable class,
  // with the town and how many classes run there.
  const venues = useMemo<VenueOption[]>(() => {
    const byId = new Map<string, VenueOption>();
    for (const c of classes) {
      if (!c.venue_id || !c.venues?.name) continue;
      const existing = byId.get(c.venue_id);
      if (existing) existing.count += 1;
      else byId.set(c.venue_id, { id: c.venue_id, name: c.venues.name, area: c.venues.city, count: 1 });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  // Bookable classes + their scheduled sessions in the next three weeks.
  // Two batched queries for the whole page — venue filtering is client-side.
  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, class_type, dance_style, venue_id, venues(name, city)")
        .eq("is_active", true)
        .eq("publicly_visible", true)
        .eq("status", "confirmed")
        .eq("booking_enabled", true)
        .eq("invite_only", false);
      const cls = (classData as unknown as TimetableClass[]) ?? [];
      setClasses(cls);

      if (cls.length > 0) {
        // Anchor the window on the next session rather than today, so during
        // holiday breaks (all of August, half terms) parents see the start of
        // next term instead of an empty screen.
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: nextRow } = await supabase
          .from("class_sessions")
          .select("session_date")
          .in("class_id", cls.map((c) => c.id))
          .eq("status", "scheduled")
          .gte("session_date", today)
          .order("session_date")
          .limit(1);
        const firstDate = (nextRow?.[0]?.session_date as string | undefined) ?? null;
        if (!firstDate) {
          setSessions([]);
          setWindowRange(null);
          setBackOn(null);
        } else {
          const horizonFromToday = format(addDays(new Date(), HORIZON_DAYS), "yyyy-MM-dd");
          setBackOn(firstDate > horizonFromToday ? firstDate : null);
          const windowStart = firstDate > today ? firstDate : today;
          const windowEnd = format(addDays(parseISO(windowStart), HORIZON_DAYS), "yyyy-MM-dd");
          const { data: sessionData } = await supabase
            .from("class_sessions")
            .select("id, class_id, session_date, start_time, end_time")
            .in("class_id", cls.map((c) => c.id))
            .eq("status", "scheduled")
            .gte("session_date", windowStart)
            .lte("session_date", windowEnd)
            .order("session_date")
            .order("start_time");
          setSessions((sessionData as SessionRow[]) ?? []);
          setWindowRange({ start: windowStart, end: windowEnd });
        }
      } else {
        setSessions([]);
        setWindowRange(null);
        setBackOn(null);
      }
      setLoading(false);
    };
    fetchTimetable();
  }, []);

  // The member's valid memberships (active / past_due / paused /
  // cancel_scheduled all still cover attendance), with the covered child.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("memberships")
      .select("id, class_id, student_id, status, students(first_name, preferred_name)")
      .eq("user_id", user.id)
      .in("status", VALID_MEMBERSHIP_STATUSES)
      .then(({ data }) => setMemberships((data as unknown as MembershipRow[]) ?? []));
  }, [user]);

  // Active adult passes, soonest-expiring first — refetched after redemption.
  const fetchPasses = useCallback(() => {
    if (!user) {
      setPasses([]);
      return;
    }
    supabase
      .from("class_passes")
      .select("id, pass_type, sessions_remaining, expires_at")
      .eq("user_id", user.id)
      .gt("sessions_remaining", 0)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at")
      .then(({ data }) => setPasses((data as PassRow[]) ?? []));
  }, [user]);
  useEffect(fetchPasses, [fetchPasses]);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );

  // First valid membership per class — enough to resolve the "Included" chip.
  const membershipByClass = useMemo(() => {
    const map = new Map<string, MembershipRow>();
    for (const m of memberships) {
      if (m.class_id && !map.has(m.class_id)) map.set(m.class_id, m);
    }
    return map;
  }, [memberships]);

  // Sessions of the selected venue, grouped by date (query already sorted by
  // date then start time).
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const cls = classById.get(s.class_id);
      if (!cls) continue;
      if (venueId !== "all" && cls.venue_id !== venueId) continue;
      if (!groups.has(s.session_date)) groups.set(s.session_date, []);
      groups.get(s.session_date)!.push(s);
    }
    return [...groups.entries()];
  }, [sessions, classById, venueId]);

  // The day strip spans the fetched window; counts follow the venue filter.
  const stripDays = useMemo(
    () => timetableStripDays(groupedByDate.flatMap(([date, rows]) => rows.map(() => date)), windowRange?.start, windowRange?.end),
    [groupedByDate, windowRange],
  );

  // The day on show: the picked one while it still has sessions at this
  // venue, otherwise the first that does. Null lists every day.
  const groupedDates = groupedByDate.map(([date]) => date);
  const shownDay = dayMode
    ? selectedDay && groupedDates.includes(selectedDay) ? selectedDay : groupedDates[0] ?? null
    : null;
  const visibleGroups = shownDay ? groupedByDate.filter(([date]) => date === shownDay) : groupedByDate;

  // All fetched adult sessions, shaped for the existing PassRedeemDialog.
  const adultSessionOptions = useMemo<SessionOption[]>(
    () =>
      sessions
        .filter((s) => classById.get(s.class_id)?.class_type === "adult")
        .map((s) => {
          const cls = classById.get(s.class_id)!;
          return {
            id: s.id,
            classId: cls.id,
            className: cls.name,
            session_date: s.session_date,
            start_time: s.start_time,
            end_time: s.end_time,
            venueName: cls.venues?.name ?? null,
          };
        }),
    [sessions, classById],
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const dateLabel = (date: string) =>
    date === todayStr
      ? "Today"
      : date === tomorrowStr
        ? "Tomorrow"
        : format(parseISO(date), "EEEE d MMMM");

  const showVenueName = venueId === "all";

  const renderAction = (cls: TimetableClass) => {
    // a. Covered by a valid membership → nothing to pay, QR is on My Bookings.
    const membership = membershipByClass.get(cls.id);
    if (membership) {
      const attendee =
        membership.students?.preferred_name || membership.students?.first_name;
      return (
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-success">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Included
          </span>
          <span className="whitespace-nowrap text-[13px] text-muted-foreground">
            {attendee ? `${attendee}'s membership` : "Your membership"}
          </span>
          <Link to="/account/bookings" className="text-[13px] font-medium text-primary hover:underline">
            My bookings
          </Link>
        </div>
      );
    }

    // b. Adult class + an active pass → redeem via the existing dialog.
    if (cls.class_type === "adult" && passes.length > 0) {
      return (
        <Button size="sm" className="h-10 rounded-full px-4 text-[14px] font-medium" onClick={() => setPassDialogOpen(true)}>
          Book with pass
        </Button>
      );
    }

    // c. Otherwise → the normal booking journey in the class browser.
    return (
      <Button
        size="sm"
        variant="soft"
        className="h-10 rounded-full px-4 text-[14px] font-medium"
        onClick={() => navigate(`/classes/${cls.class_type}`)}
      >
        Book
      </Button>
    );
  };

  const renderRow = (s: SessionRow) => {
    const cls = classById.get(s.class_id)!;
    const isAdult = cls.class_type === "adult";
    const meta = [
      cls.dance_style,
      isAdult ? "Adults" : "Children",
      showVenueName ? cls.venues?.name : null,
    ].filter(Boolean).join(" · ");
    return (
      <SessionRow
        key={s.id}
        startTime={s.start_time}
        endTime={s.end_time}
        title={cls.name}
        meta={meta || null}
        action={renderAction(cls)}
        onOpen={() => navigate(classLinkPath(cls.id))}
      />
    );
  };

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="container max-w-4xl py-8 sm:py-12">
        <SectionHeading
          as="h1"
          size="page"
          title="Timetable"
          subtitle={backOn ? "The first three weeks of next term, at every venue." : "Every class over the next three weeks, at every venue."}
        />
        <Link to="/term-dates" className="mt-3 inline-flex h-10 items-center text-[15px] font-medium text-primary hover:underline">
          Term dates, half terms and holidays
        </Link>

        {venues.length >= 2 && (
          <VenuePicker
            className="mt-6 sm:w-auto sm:min-w-[300px] sm:max-w-sm"
            venues={venues}
            value={venueId}
            onChange={setVenueId}
            totalCount={classes.length}
          />
        )}

        {!loading && backOn && (
          <QuietNotice
            className="mt-6"
            title={`We're on a break — classes are back ${format(parseISO(backOn), "EEEE d MMMM")}.`}
          >
            Here's the start of the new term so you can plan (and book) ahead.
          </QuietNotice>
        )}

        {loading ? (
          <div className="mt-8 space-y-6">
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <Bone key={i} className="h-[68px] w-[54px] shrink-0 rounded-2xl" />
              ))}
            </div>
            <ListRowsSkeleton rows={6} />
          </div>
        ) : groupedByDate.length === 0 ? (
          <EmptyState
            className="mt-8"
            title="No upcoming sessions"
            body={`Nothing is scheduled${venueId !== "all" ? " at this venue" : ""} in the next ${HORIZON_DAYS} days. ${venueId !== "all" ? "Try another venue or check back soon." : "Check back soon."}`}
            action={
              venueId !== "all" ? (
                <Button variant="soft" size="lg" className="rounded-full" onClick={() => setVenueId("all")}>
                  Show all venues
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {stripDays.length > 0 && (
              <DateStrip
                className="mt-8"
                days={stripDays}
                value={shownDay}
                onChange={(date) => { setSelectedDay(date); setDayMode(true); }}
                relativeLabels
                allDaysLabel="All days"
                onAllDays={() => setDayMode(false)}
              />
            )}

            <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {shownDay ? dateLabel(shownDay) : "All days"}
              <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                {shownDay ? format(parseISO(shownDay), "d MMM yyyy") : `next ${HORIZON_DAYS} days`}
              </span>
            </h2>

            {shownDay ? (
              <div className="surface mt-4 divide-y divide-border/70 overflow-hidden">
                {visibleGroups[0]?.[1].map(renderRow)}
              </div>
            ) : (
              visibleGroups.map(([date, rows]) => (
                <section key={date} className="mt-6">
                  {/* Sticks just below the portal header while its day scrolls */}
                  <h3 className="sticky top-16 z-10 -mx-2 bg-background/95 px-2 py-2 text-[15px] font-semibold text-foreground backdrop-blur-sm md:top-28">
                    {dateLabel(date)}
                    <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                      {format(parseISO(date), "d MMM yyyy")}
                    </span>
                  </h3>
                  <div className="surface mt-1 divide-y divide-border/70 overflow-hidden">
                    {rows.map(renderRow)}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {/* Existing no-payment pass redemption — credits cover these bookings */}
      <PassRedeemDialog
        open={passDialogOpen}
        onOpenChange={setPassDialogOpen}
        mode="pass"
        pass={passes[0] ?? null}
        sessionOptions={adultSessionOptions}
        onRedeemed={fetchPasses}
      />
    </div>
  );
};

export default Timetable;
