import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, BookOpen, MapPin, TrendingUp, UserCheck, UserCog, Sparkles, Clock, Baby, PersonStanding, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isAfter, isBefore, parseISO, differenceInCalendarDays } from "date-fns";

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
    totalClasses: 0, totalStudents: 0, totalBookings: 0,
    totalVenues: 0, activeBookings: 0, pendingPayments: 0,
    totalStaff: 0, totalWorkshops: 0,
    childrenClasses: 0, adultClasses: 0,
    childrenBookings: 0, adultBookings: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysLater = addDays(new Date(), 7).toISOString().split("T")[0];

      const thirtyDaysLater = addDays(new Date(), 30).toISOString().split("T")[0];

      const [
        classes, students, bookings, venues, pending, staffResult, workshopsResult,
        childrenClasses, adultClasses,
        childrenBookings, adultBookings,
        upcoming,
        venueContracts, staffDocs, staffExpiries,
      ] = await Promise.all([
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("venues").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
        supabase.from("staff").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("workshops").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true).eq("class_type", "children"),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true).eq("class_type", "adult"),
        supabase.from("bookings").select("id, class_id, classes!inner(class_type)", { count: "exact", head: true }).eq("classes.class_type", "children"),
        supabase.from("bookings").select("id, class_id, classes!inner(class_type)", { count: "exact", head: true }).eq("classes.class_type", "adult"),
        supabase.from("class_sessions")
          .select("id, session_date, start_time, end_time, status, class:classes(name, class_type, venue:venues(name))")
          .gte("session_date", today)
          .lte("session_date", sevenDaysLater)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(20),
        // Attention-needed sources
        supabase.from("venues")
          .select("id, name, contract_renewal_date, contract_notify_weeks")
          .eq("is_active", true)
          .not("contract_renewal_date", "is", null),
        supabase.from("staff_documents")
          .select("id, doc_type, expiry_date, label, staff:staff(full_name)")
          .not("expiry_date", "is", null)
          .lte("expiry_date", thirtyDaysLater),
        supabase.from("staff")
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
      setUpcomingSessions((upcoming.data || []) as unknown as UpcomingSession[]);

      // Build "Attention needed" alerts
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const items: AttentionItem[] = [];

      // Venue contracts: within contract_notify_weeks of today, or already past.
      // contract_notify_weeks: 1/2/3 = weeks, 4 = 1 month.
      type VenueRow = { id: string; name: string; contract_renewal_date: string | null; contract_notify_weeks: number | null };
      ((venueContracts.data as VenueRow[] | null) || []).forEach((v) => {
        if (!v.contract_renewal_date) return;
        const renewal = parseISO(v.contract_renewal_date);
        const notifyDays = v.contract_notify_weeks === 4 ? 30 : (v.contract_notify_weeks || 2) * 7;
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
      type StaffDocRow = { id: string; doc_type: string; expiry_date: string | null; label: string | null; staff: { full_name: string } | null };
      ((staffDocs.data as unknown as StaffDocRow[] | null) || []).forEach((d) => {
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
      });

      // Staff PLI / DBS within 30 days or past
      type StaffRow = { id: string; full_name: string; pli_expiry_date: string | null; dbs_expiry_date: string | null };
      ((staffExpiries.data as StaffRow[] | null) || []).forEach((s) => {
        ([
          ["PLI", s.pli_expiry_date] as const,
          ["DBS", s.dbs_expiry_date] as const,
        ]).forEach(([kind, value]) => {
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
    { title: "Total Students", value: stats.totalStudents, icon: Users, color: "text-accent", link: "/admin/students" },
    { title: "Venues", value: stats.totalVenues, icon: MapPin, color: "text-warning", link: "/admin/venues" },
    { title: "Class Types", value: stats.totalWorkshops, icon: Sparkles, color: "text-pink-400", link: "/admin/workshops" },
    { title: "Staff Members", value: stats.totalStaff, icon: UserCog, color: "text-purple-400", link: "/admin/staff" },
    { title: "Total Bookings", value: stats.totalBookings, icon: CalendarDays, color: "text-success", link: "/admin/bookings" },
    { title: "Confirmed", value: stats.activeBookings, icon: TrendingUp, color: "text-primary", link: "/admin/bookings" },
    { title: "Pending Payment", value: stats.pendingPayments, icon: UserCheck, color: "text-destructive", link: "/admin/bookings" },
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
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
          Overview of The Dance Exclusive
        </p>
      </div>

      {/* Attention Needed */}
      {!loading && attentionItems.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-warning" style={{ fontFamily: 'var(--font-body)' }}>
                  Attention Needed
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {expiredCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                    {expiredCount} expired
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {attentionItems.length} {attentionItems.length === 1 ? "item" : "items"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {attentionItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    item.expired
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-warning/30 bg-warning/10 text-foreground"
                  }`}
                >
                  <span
                    className={`shrink-0 w-2 h-2 rounded-full ${
                      item.expired ? "bg-destructive" : "bg-warning"
                    }`}
                  />
                  <span className="flex-1 min-w-0">{item.label}</span>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
                      item.expired
                        ? "bg-destructive/20 text-destructive"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {item.expired ? "Expired" : "Expiring soon"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {!loading && attentionItems.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-success" />
          All documents and contracts up to date.
        </p>
      )}

      {/* Children's & Adult Classes Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Children's Classes */}
        <Card className="border-primary/20 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-primary" style={{ fontFamily: 'var(--font-body)' }}>
                Children's Classes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors" onClick={() => navigate("/admin/classes")}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Classes</p>
                <p className="text-3xl font-display font-bold text-foreground">{loading ? "—" : stats.childrenClasses}</p>
              </div>
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors" onClick={() => navigate("/admin/bookings")}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bookings</p>
                <p className="text-3xl font-display font-bold text-foreground">{loading ? "—" : stats.childrenBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adult Classes */}
        <Card className="border-accent/20 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PersonStanding className="w-5 h-5 text-accent" />
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-accent" style={{ fontFamily: 'var(--font-body)' }}>
                Adult Classes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors" onClick={() => navigate("/admin/classes")}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Classes</p>
                <p className="text-3xl font-display font-bold text-foreground">{loading ? "—" : stats.adultClasses}</p>
              </div>
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors" onClick={() => navigate("/admin/bookings")}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bookings</p>
                <p className="text-3xl font-display font-bold text-foreground">{loading ? "—" : stats.adultBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Next 7 Days */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-display font-bold text-foreground uppercase tracking-wider">Upcoming – Next 7 Days</h2>
        </div>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-muted-foreground text-sm">Loading…</div>
            ) : upcomingSessions.length === 0 ? (
              <div className="p-6 text-muted-foreground text-sm">No sessions scheduled in the next 7 days.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {upcomingSessions.map((session) => {
                  const isChildren = session.class?.class_type === "children";
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate("/admin/calendar")}
                    >
                      <div className={`w-1 h-10 rounded-full ${isChildren ? "bg-primary" : "bg-accent"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {session.class?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.class?.venue?.name || "No venue"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-foreground">
                          {format(parseISO(session.session_date), "EEE d MMM")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(session.start_time)} – {formatTime(session.end_time)}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${isChildren ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                        {isChildren ? "Child" : "Adult"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* General Overview */}
      <div>
        <h2 className="text-lg font-display font-bold text-foreground uppercase tracking-wider mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {overviewCards.map((card, i) => (
            <Card key={card.title} onClick={() => navigate(card.link)} className="animate-fade-in border-border/50 bg-card/80 hover:border-primary/20 transition-colors cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-body)' }}>
                  {card.title}
                </CardTitle>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-foreground">
                  {loading ? "—" : card.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
