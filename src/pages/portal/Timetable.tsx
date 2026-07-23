import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, Check, Clock, MapPin, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";

interface VenueOption {
  id: string;
  name: string;
}

interface TimetableClass {
  id: string;
  name: string;
  class_type: "children" | "adult";
  dance_style: string | null;
  venue_id: string | null;
  venues: { name: string } | null;
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

const bodyFont = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
} as const;

/** Members' timetable: a dated list of upcoming sessions across venues, with
 *  per-row actions resolved from the member's own memberships and passes.
 *  Bookings ride the existing paths only — membership (already covered),
 *  pass redemption (PassRedeemDialog → redeem-pass), or the class browser. */
const Timetable = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venueId, setVenueId] = useState<string>("all");
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [passDialogOpen, setPassDialogOpen] = useState(false);

  // Venue picker options — publicly visible venues only.
  useEffect(() => {
    supabase
      .from("venues")
      .select("id, name")
      .eq("publicly_visible", true)
      .order("name")
      .then(({ data }) => setVenues((data as VenueOption[]) ?? []));
  }, []);

  // Bookable classes + their scheduled sessions in the next three weeks.
  // Two batched queries for the whole page — venue filtering is client-side.
  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, class_type, dance_style, venue_id, venues(name)")
        .eq("is_active", true)
        .eq("publicly_visible", true)
        .eq("status", "confirmed")
        .eq("booking_enabled", true)
        .eq("invite_only", false);
      const cls = (classData as unknown as TimetableClass[]) ?? [];
      setClasses(cls);

      if (cls.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");
        const horizon = format(addDays(new Date(), HORIZON_DAYS), "yyyy-MM-dd");
        const { data: sessionData } = await supabase
          .from("class_sessions")
          .select("id, class_id, session_date, start_time, end_time")
          .in("class_id", cls.map((c) => c.id))
          .eq("status", "scheduled")
          .gte("session_date", today)
          .lte("session_date", horizon)
          .order("session_date")
          .order("start_time");
        setSessions((sessionData as SessionRow[]) ?? []);
      } else {
        setSessions([]);
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
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-500 whitespace-nowrap">
            <Check className="w-3 h-3" /> Included
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap" style={bodyFont}>
            {attendee ? `${attendee}'s membership` : "Your membership"} ·{" "}
            <Link to="/account/bookings" className="text-primary hover:underline">
              My bookings
            </Link>
          </span>
        </div>
      );
    }

    // b. Adult class + an active pass → redeem via the existing dialog.
    if (cls.class_type === "adult" && passes.length > 0) {
      return (
        <Button
          size="sm"
          onClick={() => setPassDialogOpen(true)}
          className="uppercase tracking-wider text-xs font-bold gap-1.5 text-white hover:text-white hover:opacity-90"
          style={{
            background: "hsl(330, 90%, 55%)",
            boxShadow: "0 4px 14px hsl(330, 90%, 55%, 0.25)",
          }}
        >
          <Ticket className="w-3.5 h-3.5" /> Book with pass
        </Button>
      );
    }

    // c. Otherwise → the normal booking journey in the class browser.
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(`/classes/${cls.class_type}`)}
        className="uppercase tracking-wider text-xs font-bold border-border/60 hover:border-primary/50 hover:text-primary"
      >
        Book
      </Button>
    );
  };

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="container py-12 max-w-4xl">
        {/* Header + venue picker */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2.5">
              <CalendarDays className="w-7 h-7 text-primary" /> Timetable
            </h1>
            <p className="text-sm text-muted-foreground mt-1" style={bodyFont}>
              Every upcoming class over the next {HORIZON_DAYS} days. Members with a
              membership are already covered — everyone else can book in a couple of taps.
            </p>
          </div>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger className="w-full sm:w-60 shrink-0" aria-label="Filter timetable by venue">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="All venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All venues</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-16">Loading timetable...</div>
        ) : groupedByDate.length === 0 ? (
          <Card className="card-elevated border-border/50">
            <CardContent className="py-16 text-center text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p style={bodyFont}>
                No upcoming sessions{venueId !== "all" ? " at this venue" : ""} in the next{" "}
                {HORIZON_DAYS} days. Try another venue or check back soon!
              </p>
            </CardContent>
          </Card>
        ) : (
          groupedByDate.map(([date, rows]) => (
            <section key={date} className="mb-8">
              {/* Sticks just below the portal header while its day scrolls */}
              <h2 className="sticky top-16 md:top-28 z-10 -mx-2 px-2 py-2 bg-background/95 backdrop-blur-sm text-sm font-display font-bold uppercase tracking-widest text-foreground">
                {dateLabel(date)}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground" style={bodyFont}>
                  {format(parseISO(date), "d MMM yyyy")}
                </span>
              </h2>
              <Card className="card-elevated border-border/50 bg-card/80 mt-1 overflow-hidden">
                <CardContent className="p-0 divide-y divide-border/50">
                  {rows.map((s) => {
                    const cls = classById.get(s.class_id)!;
                    const isAdult = cls.class_type === "adult";
                    return (
                      <div
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 px-4 py-3.5"
                      >
                        <div className="flex items-center gap-1.5 sm:w-32 shrink-0 text-sm font-semibold text-foreground tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                          {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-foreground">{cls.name}</span>
                            {cls.dance_style && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 text-primary text-[10px] uppercase tracking-wider"
                              >
                                {cls.dance_style}
                              </Badge>
                            )}
                            <span
                              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                              style={{
                                background: isAdult
                                  ? "hsl(330, 90%, 55%)"
                                  : "hsl(193, 100%, 44%)",
                              }}
                            >
                              {isAdult ? "Adults" : "Children"}
                            </span>
                          </div>
                          {showVenueName && cls.venues?.name && (
                            <p
                              className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"
                              style={bodyFont}
                            >
                              <MapPin className="w-3 h-3 shrink-0" /> {cls.venues.name}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 sm:text-right">{renderAction(cls)}</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          ))
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
