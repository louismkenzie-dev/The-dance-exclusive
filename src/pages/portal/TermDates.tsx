import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TermSessionGroups } from "@/components/TermSessionGroups";
import {
  academicYearStart,
  buildYearRows,
  type CalendarHoliday,
  type CalendarTerm,
  type YearRow,
} from "@/lib/termCalendar";

const bodyFont = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
} as const;

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

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    return (
      <div
        key={`${r.kind}-${r.start_date}-${r.name}`}
        className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 ${
          r.current ? "bg-primary/5" : ""
        } ${r.past ? "opacity-50" : ""}`}
      >
        <div className="sm:w-60 shrink-0 text-sm font-semibold text-foreground tabular-nums" style={bodyFont}>
          {fmtRange(r.start_date, r.end_date)}
        </div>
        <div className="flex-1 min-w-0" style={bodyFont}>
          <span className={`text-sm ${isTerm ? "font-semibold text-foreground" : "text-foreground"}`}>
            {r.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {isTerm ? ` · ${r.weeks} weeks of classes` : " · no classes"}
          </span>
          {r.backOn && (
            <span className="block text-xs text-muted-foreground">
              Classes back {format(parseISO(r.backOn), "EEEE d MMMM")}
            </span>
          )}
        </div>
        <div className="shrink-0">
          {r.current ? (
            <Badge className="bg-primary text-primary-foreground text-[10px]">Now</Badge>
          ) : isTerm ? (
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Term</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-500">
              {r.kind === "bank_holiday" ? "Bank holiday" : "Break"}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="container py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-primary" /> Term Dates
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl" style={bodyFont}>
            Weekly classes run every week during term time and stop for half term, the school
            holidays and bank holidays. A few adult classes carry on through half term — the
            dates below and the Timetable always show what is actually on.
          </p>
        </div>

        {/* The year at a glance */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-foreground">
              The year {yearLabel && <span className="text-muted-foreground font-normal">· {yearLabel}</span>}
            </h2>
          </div>
          {yearLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading term dates...</div>
          ) : rows.length === 0 ? (
            <Card className="card-elevated border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground" style={bodyFont}>
                This year&apos;s term dates haven&apos;t been published yet — check back soon.
              </CardContent>
            </Card>
          ) : (
            <Card className="card-elevated border-border/50 bg-card/80 overflow-hidden">
              <CardContent className="p-0 divide-y divide-border/50">{rows.map(renderYearRow)}</CardContent>
            </Card>
          )}
        </section>

        {/* The family's own classes, date by date */}
        <section className="mb-10">
          <h2 className="text-sm font-display font-bold uppercase tracking-widest text-foreground mb-3">
            Your classes
          </h2>
          {!user ? (
            <Card className="card-elevated border-border/50">
              <CardContent className="py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground" style={bodyFont}>
                  Sign in to see every date for the classes you&apos;ve booked, term by term.
                </p>
                <Button asChild size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          ) : classesLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading your classes...</div>
          ) : classes.length === 0 ? (
            <Card className="card-elevated border-border/50">
              <CardContent className="py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground" style={bodyFont}>
                  Book a class and its dates will appear here.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/classes/children">Browse classes</Link>
                </Button>
              </CardContent>
            </Card>
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
                return (
                  <Card
                    key={cls.id}
                    id={`class-${cls.id}`}
                    className="card-elevated border-border/50 bg-card/80 scroll-mt-28 animate-fade-in"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{cls.name}</h3>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                              style={{ background: isAdult ? "hsl(330, 90%, 55%)" : "hsl(193, 100%, 44%)" }}
                            >
                              {isAdult ? "Adults" : "Children"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap" style={bodyFont}>
                            {cls.day_of_week && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" /> {capitalise(cls.day_of_week)}s
                              </span>
                            )}
                            {cls.start_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {cls.start_time.slice(0, 5)}
                                {cls.end_time && <> – {cls.end_time.slice(0, 5)}</>}
                              </span>
                            )}
                            {cls.venues?.name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> {cls.venues.name}
                              </span>
                            )}
                          </div>
                          {who.length > 0 && (
                            <p className="text-sm flex items-center gap-1.5" style={bodyFont}>
                              <Users className="w-3.5 h-3.5 text-muted-foreground" /> {who.join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0" style={bodyFont}>
                          {next ? (
                            <>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Next class</p>
                              <p className="text-sm font-semibold text-foreground">
                                {format(parseISO(next.session_date), "EEE d MMM")}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground max-w-[12rem]">
                              No more dates scheduled yet — next term&apos;s appear here as soon as they&apos;re added.
                            </p>
                          )}
                        </div>
                      </div>

                      {shown.length > 0 && (
                        <TermSessionGroups
                          sessions={shown}
                          dateOf={(s) => s.session_date}
                          className="grid gap-1"
                          renderSession={(s) => {
                            const cancelled = s.status === "cancelled";
                            return (
                              <div
                                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
                                  cancelled ? "text-muted-foreground line-through" : "bg-muted/30 text-foreground"
                                }`}
                                style={bodyFont}
                              >
                                <span>{format(parseISO(s.session_date), "EEE d MMM")}</span>
                                <span className="text-xs text-muted-foreground">
                                  {cancelled ? "Cancelled" : `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`}
                                </span>
                              </div>
                            );
                          }}
                        />
                      )}

                      {(hidden > 0 || wholeYear) && (
                        <button
                          type="button"
                          onClick={() => setShowWholeYear((prev) => ({ ...prev, [cls.id]: !wholeYear }))}
                          className="text-xs text-primary hover:underline"
                          style={bodyFont}
                        >
                          {wholeYear ? "Show this term only" : `Show the rest of the year (${hidden} more dates)`}
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm" className="uppercase tracking-wider text-xs font-bold">
            <Link to="/timetable">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Timetable — next 3 weeks
            </Link>
          </Button>
          <Button asChild size="sm" className="uppercase tracking-wider text-xs font-bold">
            <Link to="/classes/children">Browse classes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermDates;
