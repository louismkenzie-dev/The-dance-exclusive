import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffMember, getStaffPhotoUrl } from "@/hooks/useStaffMember";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeRise, Stagger, AnimatedNumber, AmbientGlow } from "@/components/motion";
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  FileText,
  TrendingUp,
  PoundSterling,
  ChevronRight,
} from "lucide-react";

interface SessionLite {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  class_id: string;
  class: {
    name: string;
    class_type: string;
    venue: { name: string } | null;
  } | null;
  attendee_count?: number;
}

const StaffDashboard = () => {
  const { staff, loading } = useStaffMember();
  const [today, setToday] = useState<SessionLite[]>([]);
  const [upcoming, setUpcoming] = useState<SessionLite[]>([]);
  const [hoursThisMonth, setHoursThisMonth] = useState(0);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);

  useEffect(() => {
    if (!staff?.id) return;
    void fetchSessions(staff.id);
  }, [staff?.id]);

  const fetchSessions = async (staffId: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // Fetch all sessions where this staff is assigned (explicit OR via class default)
    // Step 1: explicit session assignments
    const { data: explicitSessions } = await supabase
      .from("session_instructors")
      .select(`
        session_id,
        class_sessions!inner (
          id, session_date, start_time, end_time, class_id, status,
          classes:class_id ( name, class_type, venues:venue_id ( name ) )
        )
      `)
      .eq("staff_id", staffId);

    // Step 2: class-level assignments (default)
    const { data: classAssignments } = await supabase
      .from("class_instructors")
      .select("class_id")
      .eq("staff_id", staffId);

    const classIds = (classAssignments ?? []).map((c) => c.class_id);
    let defaultSessions: any[] = [];
    if (classIds.length > 0) {
      const { data } = await supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, class_id, status,
          classes:class_id ( name, class_type, venues:venue_id ( name ) )
        `)
        .in("class_id", classIds);

      // Filter out sessions that have explicit overrides (any session_instructors row)
      const overrideIds = new Set<string>();
      const { data: overrides } = await supabase
        .from("session_instructors")
        .select("session_id")
        .in(
          "session_id",
          (data ?? []).map((s) => s.id),
        );
      overrides?.forEach((o: any) => overrideIds.add(o.session_id));
      defaultSessions = (data ?? []).filter((s) => !overrideIds.has(s.id));
    }

    const allSessions: SessionLite[] = [
      ...(explicitSessions ?? []).map((row: any) => ({
        id: row.class_sessions.id,
        session_date: row.class_sessions.session_date,
        start_time: row.class_sessions.start_time,
        end_time: row.class_sessions.end_time,
        class_id: row.class_sessions.class_id,
        class: row.class_sessions.classes
          ? {
              name: row.class_sessions.classes.name,
              class_type: row.class_sessions.classes.class_type,
              venue: row.class_sessions.classes.venues ?? null,
            }
          : null,
      })),
      ...defaultSessions.map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        class_id: s.class_id,
        class: s.classes
          ? {
              name: s.classes.name,
              class_type: s.classes.class_type,
              venue: s.classes.venues ?? null,
            }
          : null,
      })),
    ];

    // Sort
    allSessions.sort((a, b) =>
      a.session_date === b.session_date
        ? a.start_time.localeCompare(b.start_time)
        : a.session_date.localeCompare(b.session_date),
    );

    setToday(allSessions.filter((s) => s.session_date === todayStr));
    setUpcoming(allSessions.filter((s) => s.session_date > todayStr).slice(0, 6));

    // Hours / sessions this month (past + today only)
    const thisMonth = allSessions.filter(
      (s) => s.session_date >= monthStartStr && s.session_date <= todayStr,
    );
    let totalMinutes = 0;
    thisMonth.forEach((s) => {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      totalMinutes += eh * 60 + em - (sh * 60 + sm);
    });
    setHoursThisMonth(Math.round((totalMinutes / 60) * 10) / 10);
    setSessionsThisMonth(thisMonth.length);
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6 md:p-8">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/8 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-display font-bold">Staff record not linked</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Your account isn't linked to a staff record yet. Please contact an admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Compliance scoring
  const checks = [
    { key: "Profile photo", ok: !!staff.profile_photo },
    { key: "Date of birth", ok: !!staff.date_of_birth },
    { key: "Address", ok: !!staff.address_line1 && !!staff.postcode },
    { key: "Bio", ok: !!staff.description },
    { key: "DBS certificate", ok: !!staff.dbs_certificate_front },
    { key: "DBS number", ok: !!staff.dbs_number },
    { key: "PLI certificate", ok: !!staff.pli_certificate },
    { key: "Next of kin", ok: !!staff.next_of_kin_name && !!staff.next_of_kin_phone },
    { key: "Dance skills", ok: (staff.dance_skills ?? []).length > 0 },
  ];
  const completed = checks.filter((c) => c.ok).length;
  const completionPct = Math.round((completed / checks.length) * 100);
  const compliantColor =
    completionPct >= 80 ? "text-success" : completionPct >= 50 ? "text-warning" : "text-destructive";

  const earningsEstimate = staff.pay_per_hour ? hoursThisMonth * Number(staff.pay_per_hour) : null;

  const photo = staff.profile_photo ? getStaffPhotoUrl(staff.profile_photo) : undefined;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Hero */}
      <FadeRise>
        <Card className="relative overflow-hidden">
          <AmbientGlow variant="light" />
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/8 text-2xl font-display font-bold text-primary">
                {photo ? (
                  <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  staff.first_name?.[0]?.toUpperCase() || "S"
                )}
              </div>
              <div className="flex-1">
                <p className="eyebrow mb-1">{greeting}</p>
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
                  {staff.first_name || staff.full_name?.split(" ")[0]}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {today.length > 0
                    ? `You have ${today.length} class${today.length > 1 ? "es" : ""} today.`
                    : upcoming.length > 0
                      ? `Next class: ${new Date(upcoming[0].session_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}.`
                      : "No upcoming classes scheduled."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeRise>

      {/* Stat row */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" childClassName="h-full">
        <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Today</p>
                <p className="text-2xl font-display font-bold tabular-nums">
                  <AnimatedNumber value={today.length} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Sessions this month</p>
                <p className="text-2xl font-display font-bold tabular-nums">
                  <AnimatedNumber value={sessionsThisMonth} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Hours this month</p>
                <p className="text-2xl font-display font-bold tabular-nums">{hoursThisMonth}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
                <PoundSterling className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Est. earnings</p>
                <p className="text-2xl font-display font-bold tabular-nums">
                  {earningsEstimate !== null ? (
                    <AnimatedNumber value={Math.round(earningsEstimate)} prefix="£" />
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Stagger>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          <FadeRise>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-display font-bold">Today's classes</h2>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/staff/classes">All classes</Link>
                  </Button>
                </div>
                {today.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Enjoy your day off — nothing scheduled.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {today.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeRise>

          <FadeRise delay={80}>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-display font-bold mb-4">Coming up</h2>
                {upcoming.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No upcoming sessions assigned.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((s) => (
                      <SessionRow key={s.id} session={s} showDate />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeRise>
        </div>

        {/* Compliance + Quick actions */}
        <div className="space-y-6">
          <FadeRise delay={120}>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-display font-bold mb-4">Profile completeness</h2>
                <div className="flex items-center gap-5 mb-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(completionPct / 100) * 213.6} 213.6`}
                        className={`transition-all duration-500 ${compliantColor}`}
                      />
                    </svg>
                    <div
                      className={`absolute inset-0 flex items-center justify-center text-lg font-display font-bold tabular-nums ${compliantColor}`}
                    >
                      {completionPct}%
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{completed} of {checks.length} done</p>
                    <p className="text-xs text-muted-foreground">
                      {completionPct === 100
                        ? "All set — great work!"
                        : "Finish your profile to unlock everything."}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {checks.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center gap-2 text-xs"
                    >
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={c.ok ? "text-muted-foreground line-through" : "text-foreground"}>
                        {c.key}
                      </span>
                    </div>
                  ))}
                </div>
                {completionPct < 100 && (
                  <Button asChild size="sm" className="w-full mt-4">
                    <Link to="/staff/profile">
                      <Sparkles className="w-3.5 h-3.5 mr-2" /> Complete profile
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </FadeRise>

          <FadeRise delay={200}>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-display font-bold mb-4">Quick actions</h2>
                <div className="space-y-2">
                  <QuickAction icon={ClipboardList} label="View registers" to="/staff/registers" />
                  <QuickAction icon={FileText} label="Upload documents" to="/staff/documents" />
                  <QuickAction icon={TrendingUp} label="My classes" to="/staff/classes" />
                </div>
              </CardContent>
            </Card>
          </FadeRise>
        </div>
      </div>
    </div>
  );
};

const SessionRow = ({ session, showDate }: { session: SessionLite; showDate?: boolean }) => {
  const isAdult = session.class?.class_type === "adult";
  return (
    <Link
      to="/staff/registers"
      className="group flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 transition-all duration-300 hover:bg-secondary"
    >
      <div className="w-16 shrink-0 text-center">
        <p className="text-base font-display font-bold tabular-nums">{session.start_time.slice(0, 5)}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {session.end_time.slice(0, 5)}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{session.class?.name || "Class"}</p>
          <Badge variant={isAdult ? "accent" : "default"} className="text-[10px]">
            {isAdult ? "Adult" : "Children"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {showDate &&
            `${new Date(session.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} • `}
          {session.class?.venue?.name || "Venue TBC"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  );
};

const QuickAction = ({
  icon: Icon,
  label,
  to,
}: {
  icon: any;
  label: string;
  to: string;
}) => (
  <Link
    to={to}
    className="group flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 transition-all duration-300 hover:bg-secondary"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <span className="flex-1 text-sm font-medium">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
  </Link>
);

export default StaffDashboard;
