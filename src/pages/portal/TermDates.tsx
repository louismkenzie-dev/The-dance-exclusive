import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TermSessionGroups } from "@/components/TermSessionGroups";
import {
  academicYearStart,
  buildYearRows,
  type CalendarHoliday,
  type CalendarTerm,
  type YearRow,
} from "@/lib/termCalendar";
import { SectionHeading } from "@/components/booking/SectionHeading";
import { Chip, ChipRow } from "@/components/booking/Chips";
import { EmptyState } from "@/components/booking/EmptyState";
import { QuietPill } from "@/components/booking/QuietPill";
import { ListRowsSkeleton, RecordCardSkeleton } from "@/components/booking/PortalSkeletons";
import { formatDay, formatTimeRange } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

interface TermRow extends CalendarTerm {
  academic_year: string;
}

interface ClassRow {
  id: string;
  name: string;
  class_type: "children" | "adult";
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  venues: { name: string } | null;
}

interface SessionRow {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface AttendeeRef {
  class_id: string | null;
  students: { first_name: string; preferred_name: string | null } | null;
}

/** Membership statuses under which the family still holds the place. */
const LIVE_MEMBERSHIP = ["active", "past_due", "paused", "cancel_scheduled"];

const fmtRange = (start: string, end: string) =>
  start === end
    ? format(parseISO(start), "EEE d MMM yyyy")
    : `${format(parseISO(start), "EEE d MMM")} – ${format(parseISO(end), "EEE d MMM yyyy")}`;

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * Term dates for parents: the year's terms, breaks and bank holidays, and —
 * for a signed-in family — the actual dates of every class they hold a
 * place in, so "is it every week except half term?" answers itself.
 */
const TermDates = () => {
  const { user } = useAuth();
  const { hash } = useLocation();
  const today = format(new Date(), "yyyy-MM-dd");

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [yearLoading, setYearLoading] = useState(true);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [showWholeYear, setShowWholeYear] = useState<Record<string, boolean>>({});

  // The year calendar admin keeps in Settings → Term Dates & Holidays.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [termsRes, holidaysRes] = await Promise.all([
        supabase
          .from("school_terms")
          .select("name, academic_year, start_date, end_date")
          .order("start_date"),
        supabase
          .from("school_holidays")
          .select("name, holiday_type, start_date, end_date")
          .order("start_date"),
      ]);
      if (cancelled) return;
      setTerms((termsRes.data as TermRow[]) ?? []);
      setHolidays((holidaysRes.data as CalendarHoliday[]) ?? []);
      setYearLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The family's classes: every class they hold a confirmed place or a live
  // membership in, with the children on each, then that class's real dates.
  useEffect(() => {
    if (!user) {
      setClasses([]);
      setSessions([]);
      setAttendees({});
      return;
    }
    let cancelled = false;
    setClassesLoading(true);
    (async () => {
      const [bookingsRes, membershipsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("class_id, students:student_id ( first_name, preferred_name )")
          .eq("parent_id", user.id)
          .eq("status", "confirmed")
          .not("class_id", "is", null),
        supabase
          .from("memberships")
          .select("class_id, students:student_id ( first_name, preferred_name )")
          .eq("user_id", user.id)
          .in("status", LIVE_MEMBERSHIP)
          .not("class_id", "is", null),
      ]);
      if (cancelled) return;

      const names: Record<string, Set<string>> = {};
      const refs = [
        ...(((bookingsRes.data as unknown) as AttendeeRef[]) ?? []),
        ...(((membershipsRes.data as unknown) as AttendeeRef[]) ?? []),
      ];
      for (const r of refs) {
        if (!r.class_id) continue;
        names[r.class_id] ??= new Set();
        const who = r.students?.preferred_name || r.students?.first_name;
        if (who) names[r.class_id].add(who);
      }
      const ids = Object.keys(names);
      if (ids.length === 0) {
        setClasses([]);
        setSessions([]);
        setAttendees({});
        setClassesLoading(false);
        return;
      }

      const [classRes, sessionRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, class_type, day_of_week, start_time, end_time, venues:venue_id ( name )")
          .in("id", ids),
        supabase
          .from("class_sessions")
          .select("id, class_id, session_date, start_time, end_time, status")
          .in("class_id", ids)
          .gte("session_date", today)
          .order("session_date")
          .order("start_time"),
      ]);
      if (cancelled) return;

      const sess = ((sessionRes.data as SessionRow[]) ?? []);
      const firstDate = (classId: string) =>
        sess.find((s) => s.class_id === classId && s.status !== "cancelled")?.session_date ?? "9999-12-31";
      const cls = (((classRes.data as unknown) as ClassRow[]) ?? [])
        .slice()
        .sort((a, b) => firstDate(a.id).localeCompare(firstDate(b.id)) || a.name.localeCompare(b.name));

      setClasses(cls);
      setSessions(sess);
      setAttendees(Object.fromEntries(ids.map((id) => [id, [...names[id]]])));
      setClassesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, today]);

  // "#class-<id>" links from My Bookings land on that class once it exists.
  useEffect(() => {
    if (!hash || classesLoading) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, classesLoading, classes.length]);

  const rows = useMemo(() => buildYearRows(terms, holidays, today), [terms, holidays, today]);

  const yearLabel = useMemo(() => {
    const from = academicYearStart(today);
    const years = [...new Set(terms.filter((t) => t.end_date >= from).map((t) => t.academic_year))];
    return years.join(" · ");
  }, [terms, today]);

  /** End of the term a date falls in, so a class card can show "this term" first. */
  const termEndFor = (date: string) =>
    terms.find((t) => date >= t.start_date && date <= t.end_date)?.end_date ?? null;

  const renderYearRow = (r: YearRow) => {
    const isTerm = r.kind === "term";
    const kindLabel = isTerm ? "Term" : r.kind === "bank_holiday" ? "Bank holiday" : "Break";
    return (
      <div
        key={`${r.kind}-${r.start_date}-${r.name}`}
        className={cn(
          "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[15rem_1fr_auto]",
          r.current && "bg-primary/5",
          r.past && "opacity-60",
        )}
      >
        <div className="text-[15px] font-semibold tabular-nums text-foreground sm:col-start-1 sm:row-start-1">
          {fmtRange(r.start_date, r.end_date)}
        </div>
        <div className="justify-self-end sm:col-start-3 sm:row-start-1">
          {r.current ? (
            <QuietPill tone="brand">Now</QuietPill>
          ) : (
            <span className="text-[13px] text-muted-foreground">{kindLabel}</span>
          )}
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <p className="text-[15px] text-foreground">
            <span className={isTerm ? "font-semibold" : "font-medium"}>{r.name}</span>
            <span className="text-muted-foreground">
              {isTerm ? ` · ${r.weeks} weeks of classes` : " · no classes"}
            </span>
          </p>
          {r.backOn && (
            <p className="text-[13px] text-muted-foreground">
              Classes back {format(parseISO(r.backOn), "EEEE d MMMM")}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="container max-w-4xl py-8 sm:py-12">
        <SectionHeading
          as="h1"
          size="page"
          title="Term dates"
          subtitle="Weekly classes run every week during term time and stop for half term, the school holidays and bank holidays. A few adult classes carry on through half term — the dates below and the timetable always show what is actually on."
        />

        {/* The year at a glance */}
        <section className="mt-10">
          <SectionHeading
            title="The year"
            aside={yearLabel ? <span className="text-[13px] font-medium text-muted-foreground">{yearLabel}</span> : undefined}
            className="mb-4"
          />
          {yearLoading ? (
            <ListRowsSkeleton rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Term dates coming soon"
              body="This year's term dates haven't been published yet — check back soon."
            />
          ) : (
            <div className="surface divide-y divide-border/70 overflow-hidden">{rows.map(renderYearRow)}</div>
          )}
        </section>

        {/* The family's own classes, date by date */}
        <section className="mt-10">
          <SectionHeading title="Your classes" className="mb-4" />
          {!user ? (
            <EmptyState
              title="Sign in to see your class dates"
              body="Every date for the classes you've booked, term by term."
              action={
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/auth">Sign in</Link>
                </Button>
              }
            />
          ) : classesLoading ? (
            <div className="space-y-4">
              <RecordCardSkeleton />
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              title="No classes yet"
              body="Book a class and its dates will appear here."
              action={
                <Button asChild variant="soft" size="lg" className="rounded-full">
                  <Link to="/classes/children">Browse classes</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {classes.map((cls) => {
                const all = sessions.filter((s) => s.class_id === cls.id);
                const live = all.filter((s) => s.status !== "cancelled");
                const next = live[0] ?? null;
                const thisTermEnd = next ? termEndFor(next.session_date) : null;
                const wholeYear = !!showWholeYear[cls.id];
                const shown = wholeYear || !thisTermEnd ? all : all.filter((s) => s.session_date <= thisTermEnd);
                const hidden = all.length - shown.length;
                const isAdult = cls.class_type === "adult";
                const who = attendees[cls.id] ?? [];
                const whenLine = [
                  cls.day_of_week ? formatDay(cls.day_of_week, "plural") : null,
                  cls.start_time ? formatTimeRange(cls.start_time, cls.end_time) : null,
                ].filter(Boolean).join(" · ");
                return (
                  <article
                    key={cls.id}
                    id={`class-${cls.id}`}
                    className="surface animate-rise-in scroll-mt-28 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="text-[13px] font-medium text-muted-foreground">
                          {[isAdult ? "Adults" : "Children", who.length > 0 ? `For ${joinNames(who)}` : null].filter(Boolean).join(" · ")}
                        </p>
                        <h3 className="mt-1 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{cls.name}</h3>
                        {whenLine && <p className="mt-2 text-[15px] text-foreground/90">{whenLine}</p>}
                        {cls.venues?.name && <p className="mt-0.5 text-[15px] text-muted-foreground">{cls.venues.name}</p>}
                      </div>
                      <div className="ml-auto shrink-0 text-right">
                        {next ? (
                          <>
                            <p className="text-[13px] text-muted-foreground">Next class</p>
                            <p className="text-[15px] font-semibold text-foreground">
                              {format(parseISO(next.session_date), "EEE d MMM")}
                            </p>
                          </>
                        ) : (
                          <p className="max-w-[14rem] text-[13px] leading-relaxed text-muted-foreground">
                            No more dates scheduled yet — next term's appear here as soon as they're added.
                          </p>
                        )}
                      </div>
                    </div>

                    {(hidden > 0 || wholeYear) && (
                      <ChipRow wrap className="mt-4">
                        <Chip
                          selected={!wholeYear}
                          onClick={() => setShowWholeYear((prev) => ({ ...prev, [cls.id]: false }))}
                        >
                          This term
                        </Chip>
                        <Chip
                          selected={wholeYear}
                          onClick={() => setShowWholeYear((prev) => ({ ...prev, [cls.id]: true }))}
                          trailing={!wholeYear ? `+${hidden}` : undefined}
                        >
                          Whole year
                        </Chip>
                      </ChipRow>
                    )}

                    {shown.length > 0 && (
                      <TermSessionGroups
                        sessions={shown}
                        dateOf={(s) => s.session_date}
                        className="mt-4 grid gap-1"
                        renderSession={(s) => {
                          const cancelled = s.status === "cancelled";
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2 text-[15px]",
                                cancelled ? "text-muted-foreground line-through" : "bg-muted/40 text-foreground",
                              )}
                            >
                              <span>{format(parseISO(s.session_date), "EEE d MMM")}</span>
                              <span className="text-[13px] tabular-nums text-muted-foreground">
                                {cancelled ? "Cancelled" : formatTimeRange(s.start_time, s.end_time)}
                              </span>
                            </div>
                          );
                        }}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="soft" size="lg" className="rounded-full">
            <Link to="/timetable">Timetable — next 3 weeks</Link>
          </Button>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/classes/children">Browse classes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermDates;
