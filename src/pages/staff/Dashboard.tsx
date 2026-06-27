import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffMember, getStaffPhotoUrl } from "@/hooks/useStaffMember";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  CalendarCheck,
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
      <div className="p-4 md:p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Staff record not linked</h2>
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
    completionPct >= 80 ? "text-emerald-500" : completionPct >= 50 ? "text-amber-500" : "text-destructive";
  const compliantStroke =
    completionPct >= 80 ? "hsl(160, 84%, 45%)" : completionPct >= 50 ? "hsl(38, 92%, 55%)" : "hsl(0, 84%, 60%)";

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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden shrink-0">
            {photo ? (
              <img src={photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              staff.first_name?.[0]?.toUpperCase() || "S"
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">
              {greeting}
            </p>
            <h1 className="text-3xl md:text-4xl font-display font-bold">
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
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{today.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessionsThisMonth}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sessions / mo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-sky-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{hoursThisMonth}h</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Hours / mo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <PoundSterling className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {earningsEstimate !== null ? `£${earningsEstimate.toFixed(0)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Today's classes</h2>
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

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Coming up</h2>
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
        </div>

        {/* Compliance + Quick actions */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Profile completeness</h2>
              <div className="flex items-center gap-5 mb-4">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke={compliantStroke}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(completionPct / 100) * 213.6} 213.6`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div
                    className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${compliantColor}`}
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
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
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

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
              <div className="space-y-2">
                <QuickAction icon={ClipboardList} label="View registers" to="/staff/registers" />
                <QuickAction icon={FileText} label="Upload documents" to="/staff/documents" />
                <QuickAction icon={TrendingUp} label="My classes" to="/staff/classes" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const SessionRow = ({ session, showDate }: { session: SessionLite; showDate?: boolean }) => {
  const isAdult = session.class?.class_type === "adult";
  const accent = isAdult ? "border-l-[hsl(330,90%,55%)]" : "border-l-primary";
  const badge = isAdult ? "bg-[hsl(330,90%,55%)]/15 text-[hsl(330,90%,55%)]" : "bg-primary/15 text-primary";
  return (
    <Link
      to="/staff/registers"
      className={`flex items-center gap-3 p-3 rounded-md border border-border ${accent} border-l-4 hover:bg-accent/30 transition-colors`}
    >
      <div className="text-center px-2 shrink-0 w-16">
        <p className="text-base font-bold tabular-nums">{session.start_time.slice(0, 5)}</p>
        <p className="text-[10px] text-muted-foreground uppercase">
          {session.end_time.slice(0, 5)}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{session.class?.name || "Class"}</p>
          <Badge variant="outline" className={`text-[10px] ${badge} border-transparent`}>
            {isAdult ? "Adult" : "Children"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {showDate &&
            `${new Date(session.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} • `}
          {session.class?.venue?.name || "Venue TBC"}
        </p>
      </div>
      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
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
    className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent/30 transition-colors group"
  >
    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <span className="text-sm flex-1">{label}</span>
    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
  </Link>
);

export default StaffDashboard;