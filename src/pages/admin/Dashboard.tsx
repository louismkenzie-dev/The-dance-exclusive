import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  Users,
  MapPin,
  TrendingUp,
  UserCheck,
  UserCog,
  Sparkles,
  Clock,
  Baby,
  PersonStanding,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeRise, Stagger, AnimatedNumber } from "@/components/motion";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";

interface Stats {
  totalClasses: number;
  totalStudents: number;
  totalBookings: number;
  totalVenues: number;
  activeBookings: number;
  pendingPayments: number;
  totalStaff: number;
  totalWorkshops: number;
  childrenClasses: number;
  adultClasses: number;
  childrenBookings: number;
  adultBookings: number;
}

interface UpcomingSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  class: {
    name: string;
    class_type: string;
    venue: { name: string } | null;
  } | null;
}

interface AttentionItem {
  id: string;
  label: string;
  date: string; // ISO date (yyyy-MM-dd)
  expired: boolean; // true = overdue/expired (red), false = upcoming (amber)
}

const DOC_TYPE_LABELS: Record<string, string> = {
  paediatric_first_aid: "Paediatric First Aid",
  other_first_aid: "First Aid",
  safeguarding: "Safeguarding",
  dbs: "DBS",
  pli: "Public Liability Insurance",
  other: "Document",
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalClasses: 0,
    totalStudents: 0,
    totalBookings: 0,
    totalVenues: 0,
    activeBookings: 0,
    pendingPayments: 0,
    totalStaff: 0,
    totalWorkshops: 0,
    childrenClasses: 0,
    adultClasses: 0,
    childrenBookings: 0,
    adultBookings: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>(
    [],
  );
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysLater = addDays(new Date(), 7).toISOString().split("T")[0];

      const thirtyDaysLater = addDays(new Date(), 30)
        .toISOString()
        .split("T")[0];

      const [
        classes,
        students,
        bookings,
        venues,
        pending,
        staffResult,
        workshopsResult,
        childrenClasses,
        adultClasses,
        childrenBookings,
        adultBookings,
        upcoming,
        venueContracts,
        staffDocs,
        staffExpiries,
      ] = await Promise.all([
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase
          .from("venues")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_payment"),
        supabase
          .from("staff")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("workshops")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("class_type", "children"),
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("class_type", "adult"),
        supabase
          .from("bookings")
          .select("id, class_id, classes!inner(class_type)", {
            count: "exact",
            head: true,
          })
          .eq("classes.class_type", "children"),
        supabase
          .from("bookings")
          .select("id, class_id, classes!inner(class_type)", {
            count: "exact",
            head: true,
          })
          .eq("classes.class_type", "adult"),
        supabase
          .from("class_sessions")
          .select(
            "id, session_date, start_time, end_time, status, class:classes(name, class_type, venue:venues(name))",
          )
          .gte("session_date", today)
          .lte("session_date", sevenDaysLater)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(20),
        // Attention-needed sources
        supabase
          .from("venues")
          .select("id, name, contract_renewal_date, contract_notify_weeks")
          .eq("is_active", true)
          .not("contract_renewal_date", "is", null),
        supabase
          .from("staff_documents")
          .select("id, doc_type, expiry_date, label, staff:staff(full_name)")
          .not("expiry_date", "is", null)
          .lte("expiry_date", thirtyDaysLater),
        supabase
          .from("staff")
          .select("id, full_name, pli_expiry_date, dbs_expiry_date")
          .eq("is_active", true),
      ]);

      setStats({
        totalClasses: classes.count || 0,
        totalStudents: students.count || 0,
        totalBookings: bookings.count || 0,
        totalVenues: venues.count || 0,
        activeBookings: (bookings.count || 0) - (pending.count || 0),
        pendingPayments: pending.count || 0,
        totalStaff: staffResult.count || 0,
        totalWorkshops: workshopsResult.count || 0,
        childrenClasses: childrenClasses.count || 0,
        adultClasses: adultClasses.count || 0,
        childrenBookings: childrenBookings.count || 0,
        adultBookings: adultBookings.count || 0,
      });
      setUpcomingSessions(
        (upcoming.data || []) as unknown as UpcomingSession[],
      );

      // Build "Attention needed" alerts
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const items: AttentionItem[] = [];

      // Venue contracts: within contract_notify_weeks of today, or already past.
      // contract_notify_weeks: 1/2/3 = weeks, 4 = 1 month.
      type VenueRow = {
        id: string;
        name: string;
        contract_renewal_date: string | null;
        contract_notify_weeks: number | null;
      };
      ((venueContracts.data as VenueRow[] | null) || []).forEach((v) => {
        if (!v.contract_renewal_date) return;
        const renewal = parseISO(v.contract_renewal_date);
        const notifyDays =
          v.contract_notify_weeks === 4
            ? 30
            : (v.contract_notify_weeks || 2) * 7;
        const daysUntil = differenceInCalendarDays(renewal, startOfToday);
        if (daysUntil <= notifyDays) {
          items.push({
            id: `venue-${v.id}`,
            label: `Contract for ${v.name} renews on ${format(renewal, "d MMM yyyy")}`,
            date: v.contract_renewal_date,
            expired: daysUntil < 0,
          });
        }
      });

      // Staff documents expiring/expired within 30 days
      type StaffDocRow = {
        id: string;
        doc_type: string;
        expiry_date: string | null;
        label: string | null;
        staff: { full_name: string } | null;
      };
      ((staffDocs.data as unknown as StaffDocRow[] | null) || []).forEach(
        (d) => {
          if (!d.expiry_date) return;
          const expiry = parseISO(d.expiry_date);
          const docLabel = DOC_TYPE_LABELS[d.doc_type] || d.label || "Document";
          const staffName = d.staff?.full_name || "Unknown staff";
          items.push({
            id: `doc-${d.id}`,
            label: `${staffName}: ${docLabel} expires ${format(expiry, "d MMM yyyy")}`,
            date: d.expiry_date,
            expired: differenceInCalendarDays(expiry, startOfToday) < 0,
          });
        },
      );

      // Staff PLI / DBS within 30 days or past
      type StaffRow = {
        id: string;
        full_name: string;
        pli_expiry_date: string | null;
        dbs_expiry_date: string | null;
      };
      ((staffExpiries.data as StaffRow[] | null) || []).forEach((s) => {
        [
          ["PLI", s.pli_expiry_date] as const,
          ["DBS", s.dbs_expiry_date] as const,
        ].forEach(([kind, value]) => {
          if (!value) return;
          const expiry = parseISO(value);
          const daysUntil = differenceInCalendarDays(expiry, startOfToday);
          if (daysUntil <= 30) {
            items.push({
              id: `staff-${kind}-${s.id}`,
              label: `${s.full_name}: ${kind} expires ${format(expiry, "d MMM yyyy")}`,
              date: value,
              expired: daysUntil < 0,
            });
          }
        });
      });

      // Sort: expired first, then by soonest date
      items.sort((a, b) => {
        if (a.expired !== b.expired) return a.expired ? -1 : 1;
        return a.date.localeCompare(b.date);
      });
      setAttentionItems(items);

      setLoading(false);
    };
    fetchStats();
  }, []);

  const navigate = useNavigate();

  const overviewCards = [
    {
      title: "Total students",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-accent/8 text-accent",
      link: "/admin/students",
    },
    {
      title: "Venues",
      value: stats.totalVenues,
      icon: MapPin,
      color: "bg-warning/8 text-warning",
      link: "/admin/venues",
    },
    {
      title: "Class types",
      value: stats.totalWorkshops,
      icon: Sparkles,
      color: "bg-accent/8 text-accent",
      link: "/admin/workshops",
    },
    {
      title: "Staff members",
      value: stats.totalStaff,
      icon: UserCog,
      color: "bg-primary/8 text-primary",
      link: "/admin/staff",
    },
    {
      title: "Total bookings",
      value: stats.totalBookings,
      icon: CalendarDays,
      color: "bg-success/8 text-success",
      link: "/admin/bookings",
    },
    {
      title: "Confirmed",
      value: stats.activeBookings,
      icon: TrendingUp,
      color: "bg-primary/8 text-primary",
      link: "/admin/bookings",
    },
    {
      title: "Pending payment",
      value: stats.pendingPayments,
      icon: UserCheck,
      color: "bg-destructive/8 text-destructive",
      link: "/admin/bookings",
    },
  ];

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "pm" : "am";
    const h12 = hour % 12 || 12;
    return `${h12}:${m}${ampm}`;
  };

  const expiredCount = attentionItems.filter((i) => i.expired).length;

  return (
    <div className="p-4 md:p-8 space-y-10">
      {/* Header */}
      <FadeRise>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of The Dance Exclusive
        </p>
      </FadeRise>

      {/* Attention needed */}
      {!loading && attentionItems.length > 0 && (
        <FadeRise>
          <Card className="bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base font-display font-bold text-foreground">
                    Attention needed
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {expiredCount > 0 && (
                    <Badge variant="destructive">{expiredCount} expired</Badge>
                  )}
                  <Badge variant="warning">
                    {attentionItems.length}{" "}
                    {attentionItems.length === 1 ? "item" : "items"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {attentionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm shadow-soft"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                        item.expired
                          ? "bg-destructive/8 text-destructive"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {item.expired ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <span className="flex-1 min-w-0 font-medium text-foreground">
                      {item.label}
                    </span>
                    <Badge
                      variant={item.expired ? "destructive" : "warning"}
                      className="shrink-0"
                    >
                      {item.expired ? "Expired" : "Expiring soon"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeRise>
      )}
      {!loading && attentionItems.length === 0 && (
        <FadeRise>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            All documents and contracts up to date.
          </p>
        </FadeRise>
      )}

      {/* Children's & adult classes side by side */}
      <Stagger
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        childClassName="h-full"
      >
        {/* Children's classes */}
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Baby className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-display font-bold text-foreground">
                Children's classes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-2xl bg-secondary/60 p-4 text-left transition-all duration-300 hover:bg-secondary hover:-translate-y-0.5 cursor-pointer"
                onClick={() => navigate("/admin/classes")}
              >
                <p className="eyebrow mb-1">Active classes</p>
                <p className="text-3xl md:text-4xl font-display font-bold tabular-nums text-primary">
                  {loading ? (
                    "—"
                  ) : (
                    <AnimatedNumber value={stats.childrenClasses} />
                  )}
                </p>
              </button>
              <button
                type="button"
                className="rounded-2xl bg-secondary/60 p-4 text-left transition-all duration-300 hover:bg-secondary hover:-translate-y-0.5 cursor-pointer"
                onClick={() => navigate("/admin/bookings")}
              >
                <p className="eyebrow mb-1">Bookings</p>
                <p className="text-3xl md:text-4xl font-display font-bold tabular-nums text-primary">
                  {loading ? (
                    "—"
                  ) : (
                    <AnimatedNumber value={stats.childrenBookings} />
                  )}
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Adult classes */}
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                <PersonStanding className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-display font-bold text-foreground">
                Adult classes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-2xl bg-secondary/60 p-4 text-left transition-all duration-300 hover:bg-secondary hover:-translate-y-0.5 cursor-pointer"
                onClick={() => navigate("/admin/classes")}
              >
                <p className="eyebrow mb-1">Active classes</p>
                <p className="text-3xl md:text-4xl font-display font-bold tabular-nums text-accent">
                  {loading ? (
                    "—"
                  ) : (
                    <AnimatedNumber value={stats.adultClasses} />
                  )}
                </p>
              </button>
              <button
                type="button"
                className="rounded-2xl bg-secondary/60 p-4 text-left transition-all duration-300 hover:bg-secondary hover:-translate-y-0.5 cursor-pointer"
                onClick={() => navigate("/admin/bookings")}
              >
                <p className="eyebrow mb-1">Bookings</p>
                <p className="text-3xl md:text-4xl font-display font-bold tabular-nums text-accent">
                  {loading ? (
                    "—"
                  ) : (
                    <AnimatedNumber value={stats.adultBookings} />
                  )}
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      </Stagger>

      {/* Upcoming – next 7 days */}
      <div>
        <FadeRise className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <Clock className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground">
            Upcoming – next 7 days
          </h2>
        </FadeRise>
        {loading ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground text-sm">
              Loading…
            </CardContent>
          </Card>
        ) : upcomingSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground text-sm">
              No sessions scheduled in the next 7 days.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session, i) => {
              const isChildren = session.class?.class_type === "children";
              return (
                <FadeRise key={session.id} delay={Math.min(i, 8) * 60}>
                  <Card
                    className="flex items-center gap-3 p-4 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                    onClick={() => navigate("/admin/calendar")}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        isChildren
                          ? "bg-primary/8 text-primary"
                          : "bg-accent/8 text-accent"
                      }`}
                    >
                      {isChildren ? (
                        <Baby className="h-5 w-5" />
                      ) : (
                        <PersonStanding className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {session.class?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.class?.venue?.name || "No venue"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {format(parseISO(session.session_date), "EEE d MMM")}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatTime(session.start_time)} –{" "}
                        {formatTime(session.end_time)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isChildren
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {isChildren ? "Child" : "Adult"}
                    </span>
                  </Card>
                </FadeRise>
              );
            })}
          </div>
        )}
      </div>

      {/* General overview */}
      <div>
        <FadeRise>
          <h2 className="text-lg font-display font-bold text-foreground mb-4">
            Overview
          </h2>
        </FadeRise>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {overviewCards.map((card, i) => (
            <FadeRise
              key={card.title}
              delay={Math.min(i, 8) * 60}
              className="h-full"
            >
              <Card
                onClick={() => navigate(card.link)}
                className="h-full cursor-pointer transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3 pb-2">
                  <p className="eyebrow">{card.title}</p>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.color}`}
                  >
                    <card.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl md:text-4xl font-display font-bold tabular-nums text-foreground">
                    {loading ? "—" : <AnimatedNumber value={card.value} />}
                  </div>
                </CardContent>
              </Card>
            </FadeRise>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
