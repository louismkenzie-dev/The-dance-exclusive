import { useEffect, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ADULT_PASSES, type AdultPassType } from "@/lib/pricing";
import MoveMembershipDialog, { type MoveMembershipTarget } from "@/components/admin/MoveMembershipDialog";

interface Booking {
  id: string;
  status: string;
  booking_type: string;
  class_id: string | null;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  classes: { name: string; class_type: string } | null;
  students: { first_name: string; last_name: string } | null;
  profiles: { full_name: string; email: string } | null;
}

/** Booking types the admin can move to another class in place. Monthly
 *  memberships are excluded — they're Stripe subscriptions with their own
 *  change-class flow; camps/passes have no class to move. */
const MOVABLE_TYPES = ["trial", "session", "term", "yearly"];

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  pending_payment: "secondary",
  cancelled: "destructive",
};

interface ClassPass {
  id: string;
  user_id: string;
  pass_type: string;
  sessions_total: number;
  sessions_remaining: number;
  amount_paid: number;
  purchased_at: string;
  expires_at: string;
  profile: { full_name: string; email: string } | null;
}

type PassStatus = "active" | "expired" | "used_up";

const passStatus = (p: ClassPass): PassStatus => {
  if (p.sessions_remaining <= 0) return "used_up";
  if (new Date(p.expires_at).getTime() < Date.now()) return "expired";
  return "active";
};

const passStatusBadge: Record<PassStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  expired: { label: "Expired", variant: "secondary" },
  used_up: { label: "Used up", variant: "outline" },
};

/** Admin view of every customer's multi-class pass: credits left and validity. */
const ClassPassesTab = () => {
  const [passes, setPasses] = useState<ClassPass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPasses = async () => {
      const { data } = await supabase
        .from("class_passes")
        .select("id, user_id, pass_type, sessions_total, sessions_remaining, amount_paid, purchased_at, expires_at")
        .order("purchased_at", { ascending: false });
      if (data) {
        // No FK between class_passes.user_id and profiles — join client-side.
        const userIds = [...new Set(data.map((p) => p.user_id))];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : { data: [] };
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        setPasses(data.map((p) => ({ ...p, profile: profileMap.get(p.user_id) ?? null })));
      }
      setLoading(false);
    };
    fetchPasses();
  }, []);

  // Active passes first (soonest expiry at the top), then past ones.
  const sorted = [...passes].sort((a, b) => {
    const rankA = passStatus(a) === "active" ? 0 : 1;
    const rankB = passStatus(b) === "active" ? 0 : 1;
    return rankA - rankB || new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
  });
  const activeCount = passes.filter((p) => passStatus(p) === "active").length;

  if (loading) return <div className="text-muted-foreground">Loading passes...</div>;
  if (passes.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No class passes purchased yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {activeCount} active pass{activeCount === 1 ? "" : "es"} · {passes.length} total
      </p>
      <Card className="animate-fade-in">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Pass</TableHead>
                <TableHead>Classes left</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Amount paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
                const status = passStatus(p);
                const badge = passStatusBadge[status];
                const expiryDate = new Date(p.expires_at);
                const isExpired = expiryDate.getTime() < Date.now();
                const daysLeft = differenceInCalendarDays(expiryDate, new Date());
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.profile?.full_name || "Unknown"}</span>
                      <span className="block text-xs text-muted-foreground">{p.profile?.email || "—"}</span>
                    </TableCell>
                    <TableCell>{ADULT_PASSES[p.pass_type as AdultPassType]?.label ?? p.pass_type}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{p.sessions_remaining}</span>
                      <span className="text-muted-foreground"> of {p.sessions_total}</span>
                    </TableCell>
                    <TableCell>{format(new Date(p.purchased_at), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      {format(expiryDate, "d MMM yyyy")}
                      <span className={`block text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                        {isExpired ? "Expired" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                      </span>
                    </TableCell>
                    <TableCell>£{Number(p.amount_paid).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

interface AdminMembership {
  id: string;
  user_id: string;
  monthly_amount: number;
  status: string;
  started_at: string;
  current_period_end: string | null;
  cancel_at: string | null;
  students: { first_name: string; last_name: string } | null;
  classes: { name: string; day_of_week: string | null; start_time: string | null } | null;
  profile: { full_name: string; email: string } | null;
}

const membershipBadge: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "border-transparent bg-emerald-600 text-white" },
  past_due: { label: "Payment issue", className: "border-transparent bg-amber-500 text-white" },
  paused: { label: "Paused", className: "border-transparent bg-secondary text-secondary-foreground" },
  cancel_scheduled: { label: "Ending", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  cancelled: { label: "Ended", className: "border-transparent bg-muted text-muted-foreground" },
  incomplete: { label: "Incomplete", className: "text-muted-foreground" },
};

/** One row in the unified "who's on what plan" view — a monthly membership
 *  (Stripe subscription) or a one-off plan purchase (termly/yearly/trial/PAYG). */
type PlanKind = "monthly" | "yearly" | "term" | "trial" | "session";

interface PlanRow {
  key: string;
  plan: PlanKind;
  parentName: string;
  parentEmail: string;
  childName: string;
  className: string;
  classSchedule: string | null;
  amount: number;
  perMonth: boolean;
  statusLabel: string;
  statusClass: string;
  started: string;
  nextCharge: string | null;
  ends: string | null;
  live: boolean;
  /** Set on monthly rows — enables the admin "Move" (class transfer) action. */
  membershipId: string | null;
  classId: string | null;
}

const planMeta: Record<PlanKind, { label: string; className: string }> = {
  monthly: { label: "Monthly", className: "border-primary/40 bg-primary/10 text-primary" },
  yearly: { label: "Yearly", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  term: { label: "Termly", className: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  trial: { label: "Trial", className: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400" },
  session: { label: "Pay as you go", className: "border-border bg-muted text-muted-foreground" },
};

const PLAN_ORDER: PlanKind[] = ["monthly", "yearly", "term", "trial", "session"];

/** All of one customer's monthly memberships, rolled up for the family card. */
interface FamilyGroup {
  email: string;
  name: string;
  rows: PlanRow[];
  liveTotal: number;
  statusChips: { label: string; count: number; className: string }[];
  unlimited: boolean;
  hasLive: boolean;
  /** Every non-ended row is an abandoned checkout — nothing was ever charged. */
  incompleteOnly: boolean;
  incompleteTotal: number;
}

const STATUS_CHIP_ORDER = ["Active", "Payment issue", "Paused", "Ending", "Incomplete", "Ended"];

/** Admin view of every plan a family is on: monthly memberships (real Stripe
 *  subscriptions) plus termly / yearly / trial / pay-as-you-go purchases,
 *  categorised so it's easy to find who's on what. */
const MembershipsTab = () => {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ activeCount: 0, recurring: 0, pausedCount: 0 });
  const [planFilter, setPlanFilter] = useState<"all" | PlanKind>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [moveTarget, setMoveTarget] = useState<MoveMembershipTarget | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPlans = async () => {
      const [membershipsRes, bookingsRes] = await Promise.all([
        supabase
          .from("memberships")
          .select("id, user_id, class_id, monthly_amount, status, started_at, current_period_end, cancel_at, students(first_name, last_name), classes(name, day_of_week, start_time)")
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, parent_id, booking_type, amount, booked_at, students(first_name, last_name), classes(name, day_of_week, start_time)")
          .in("booking_type", ["term", "yearly", "trial", "session"])
          .eq("status", "confirmed")
          .order("booked_at", { ascending: false }),
      ]);

      const memberships = (membershipsRes.data ?? []) as unknown as (Omit<AdminMembership, "profile"> & { user_id: string })[];
      const planBookings = (bookingsRes.data ?? []) as any[];

      // No FK between memberships.user_id / bookings.parent_id and profiles —
      // join client-side.
      const userIds = [...new Set([
        ...memberships.map((m) => m.user_id),
        ...planBookings.map((b) => b.parent_id),
      ])];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      const schedule = (cls: { day_of_week: string | null; start_time: string | null } | null) =>
        cls?.day_of_week
          ? `${cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)}${cls.start_time ? ` ${cls.start_time.slice(0, 5)}` : ""}`
          : null;

      const isLive = (s: string) => s === "active" || s === "past_due" || s === "cancel_scheduled";

      const membershipRows: PlanRow[] = memberships.map((m) => {
        const badge = membershipBadge[m.status] ?? { label: m.status, className: "" };
        const profile = profileMap.get(m.user_id);
        return {
          key: `m-${m.id}`,
          plan: "monthly",
          parentName: profile?.full_name || "Unknown",
          parentEmail: profile?.email || "—",
          childName: m.students ? `${m.students.first_name} ${m.students.last_name}` : "—",
          className: m.classes?.name || "—",
          classSchedule: schedule(m.classes),
          amount: Number(m.monthly_amount),
          perMonth: true,
          statusLabel: badge.label,
          statusClass: badge.className,
          started: m.started_at,
          nextCharge: m.status !== "cancelled" ? m.current_period_end : null,
          ends: m.cancel_at,
          live: isLive(m.status),
          membershipId: m.id,
          classId: (m as any).class_id ?? null,
        };
      });

      const bookingRows: PlanRow[] = planBookings.map((b) => {
        const profile = profileMap.get(b.parent_id);
        const plan = (["yearly", "term", "trial", "session"].includes(b.booking_type) ? b.booking_type : "session") as PlanKind;
        return {
          key: `b-${b.id}`,
          plan,
          parentName: profile?.full_name || "Unknown",
          parentEmail: profile?.email || "—",
          childName: b.students ? `${b.students.first_name} ${b.students.last_name}` : "—",
          className: b.classes?.name || "—",
          classSchedule: schedule(b.classes),
          amount: Number(b.amount ?? 0),
          perMonth: false,
          statusLabel: "Paid",
          statusClass: "border-transparent bg-emerald-600 text-white",
          started: b.booked_at,
          nextCharge: null,
          ends: null,
          live: true,
          membershipId: null,
          classId: null,
        };
      });

      setRows([...membershipRows, ...bookingRows]);
      // "Live" includes paused — every August the maintenance job pauses all
      // monthly subscriptions (no payments in August, resuming 1 September),
      // and counting only status==='active' made the whole book look gone.
      const liveStatuses = ["active", "paused", "past_due", "cancel_scheduled"];
      const live = memberships.filter((m) => liveStatuses.includes(m.status));
      setMonthlyStats({
        activeCount: live.length,
        recurring: live.reduce((sum, m) => sum + Number(m.monthly_amount), 0),
        pausedCount: memberships.filter((m) => m.status === "paused").length,
      });
      setLoading(false);
    };
    fetchPlans();
  }, [refreshKey]);

  const counts = PLAN_ORDER.reduce((acc, p) => {
    acc[p] = rows.filter((r) => r.plan === p).length;
    return acc;
  }, {} as Record<PlanKind, number>);

  const matchesSearch = (r: PlanRow) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.parentName.toLowerCase().includes(s) ||
      r.parentEmail.toLowerCase().includes(s) ||
      r.childName.toLowerCase().includes(s) ||
      r.className.toLowerCase().includes(s)
    );
  };

  const charge = (r: PlanRow) => (r.nextCharge ? new Date(r.nextCharge).getTime() : Number.MAX_SAFE_INTEGER);

  // One-off plans keep the flat table, grouped by plan (yearly → termly →
  // trial → PAYG), live rows first.
  const oneOffSorted = rows
    .filter((r) => r.plan !== "monthly" && (planFilter === "all" || r.plan === planFilter) && matchesSearch(r))
    .sort((a, b) => {
      const planRank = PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan);
      if (planRank !== 0) return planRank;
      if (a.live !== b.live) return a.live ? -1 : 1;
      return charge(a) - charge(b) || a.parentName.localeCompare(b.parentName);
    });

  // Monthly memberships roll up into one collapsible card per customer. A
  // search match on any row keeps the whole family card (with full totals)
  // so the headline £/mo never shows a partial figure.
  const familyGroups: FamilyGroup[] = [...rows
    .filter((r) => r.plan === "monthly")
    .reduce((map, r) => {
      const list = map.get(r.parentEmail);
      if (list) list.push(r);
      else map.set(r.parentEmail, [r]);
      return map;
    }, new Map<string, PlanRow[]>())
    .entries()]
    .map(([email, familyRows]): FamilyGroup => {
      // "Charging" = plans Stripe will actually collect (paused/past_due still
      // count towards the family's recurring total and the £110 cap).
      // Incomplete rows are abandoned checkouts — no payment was ever taken,
      // so they never contribute to the headline £/mo.
      const charging = familyRows.filter((r) => r.statusLabel !== "Ended" && r.statusLabel !== "Incomplete");
      const incomplete = familyRows.filter((r) => r.statusLabel === "Incomplete");
      const perChild = new Map<string, number>();
      for (const r of charging) {
        if (r.childName !== "—") perChild.set(r.childName, (perChild.get(r.childName) ?? 0) + r.amount);
      }
      const countsByLabel = new Map<string, { count: number; className: string }>();
      for (const r of familyRows) {
        const entry = countsByLabel.get(r.statusLabel);
        if (entry) entry.count += 1;
        else countsByLabel.set(r.statusLabel, { count: 1, className: r.statusClass });
      }
      const chipRank = (label: string) => {
        const i = STATUS_CHIP_ORDER.indexOf(label);
        return i === -1 ? STATUS_CHIP_ORDER.length : i;
      };
      return {
        email,
        name: familyRows[0].parentName,
        rows: [...familyRows].sort((a, b) =>
          a.live !== b.live ? (a.live ? -1 : 1) : charge(a) - charge(b) || a.childName.localeCompare(b.childName),
        ),
        liveTotal: charging.reduce((sum, r) => sum + r.amount, 0),
        statusChips: [...countsByLabel.entries()]
          .sort((a, b) => chipRank(a[0]) - chipRank(b[0]))
          .map(([label, { count, className }]) => ({ label, count, className })),
        unlimited: [...perChild.values()].some((total) => total >= 110),
        hasLive: familyRows.some((r) => r.live),
        incompleteOnly: charging.length === 0 && incomplete.length > 0,
        incompleteTotal: incomplete.reduce((sum, r) => sum + r.amount, 0),
      };
    })
    .filter((g) => g.rows.some(matchesSearch))
    .sort((a, b) => (a.hasLive !== b.hasLive ? (a.hasLive ? -1 : 1) : a.name.localeCompare(b.name)));

  const payingGroups = familyGroups.filter((g) => !g.incompleteOnly);
  const abandonedGroups = familyGroups.filter((g) => g.incompleteOnly);

  const showMonthly = planFilter === "all" || planFilter === "monthly";
  const showOneOff = planFilter !== "monthly";
  const nothingToShow =
    (!showMonthly || familyGroups.length === 0) && (!showOneOff || oneOffSorted.length === 0);

  if (loading) return <div className="text-muted-foreground">Loading plans...</div>;
  if (rows.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No memberships or plan purchases yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {monthlyStats.activeCount} live monthly membership{monthlyStats.activeCount === 1 ? "" : "s"} · £
        {monthlyStats.recurring.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month recurring
        {monthlyStats.pausedCount > 0 && (
          <span className="block text-xs mt-0.5">
            {monthlyStats.pausedCount} paused for the August break — no payments this month, everything resumes automatically on 1 September.
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={planFilter === "all" ? "default" : "outline"}
          onClick={() => setPlanFilter("all")}
        >
          All ({rows.length})
        </Button>
        {PLAN_ORDER.filter((p) => counts[p] > 0).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={planFilter === p ? "default" : "outline"}
            onClick={() => setPlanFilter(p)}
          >
            {planMeta[p].label} ({counts[p]})
          </Button>
        ))}
        <Input
          placeholder="Search parent, child or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs ml-auto"
        />
      </div>

      {nothingToShow ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No plans match your search.</CardContent></Card>
      ) : (
        <>
          {showMonthly && payingGroups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly memberships</h3>
              {payingGroups.map((g) => (
                <Collapsible key={g.email}>
                  <Card className="animate-fade-in">
                    <CollapsibleTrigger asChild>
                      <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 cursor-pointer hover:bg-accent/30 transition-colors">
                        <div>
                          <span className="font-medium">{g.name}</span>
                          <span className="block text-xs text-muted-foreground">{g.email}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="font-semibold whitespace-nowrap">
                            £{g.liveTotal.toFixed(2)}
                            <span className="text-xs font-normal text-muted-foreground">/mo</span>
                          </span>
                          {g.statusChips.map((c) => (
                            <Badge key={c.label} variant="outline" className={c.className}>
                              {c.count} {c.label.toLowerCase()}
                            </Badge>
                          ))}
                          {g.unlimited && <Badge className="whitespace-nowrap">Unlimited £110</Badge>}
                          <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Child</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead>£/mo</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Started</TableHead>
                              <TableHead>Next charge</TableHead>
                              <TableHead>Ends</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.rows.map((r) => (
                              <TableRow key={r.key}>
                                <TableCell>{r.childName}</TableCell>
                                <TableCell>
                                  <span>{r.className}</span>
                                  {r.classSchedule && (
                                    <span className="block text-xs text-muted-foreground">{r.classSchedule}</span>
                                  )}
                                </TableCell>
                                <TableCell>£{r.amount.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={r.statusClass}>{r.statusLabel}</Badge>
                                </TableCell>
                                <TableCell>{format(new Date(r.started), "d MMM yyyy")}</TableCell>
                                <TableCell>{r.nextCharge ? format(new Date(r.nextCharge), "d MMM yyyy") : "—"}</TableCell>
                                <TableCell>{r.ends ? format(new Date(r.ends), "d MMM yyyy") : "—"}</TableCell>
                                <TableCell className="text-right">
                                  {r.membershipId && (r.statusLabel === "Active" || r.statusLabel === "Paused") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setMoveTarget({
                                        membershipId: r.membershipId!,
                                        parentName: r.parentName,
                                        childName: r.childName,
                                        className: r.className,
                                        classId: r.classId,
                                      })}
                                    >
                                      Move
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}

          {showMonthly && abandonedGroups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unfinished checkouts</h3>
              <p className="text-xs text-muted-foreground -mt-1">
                These parents started a membership checkout but never completed payment — nothing has been or
                will be charged. Worth a friendly follow-up.
              </p>
              {abandonedGroups.map((g) => (
                <Collapsible key={g.email}>
                  <Card className="animate-fade-in border-dashed">
                    <CollapsibleTrigger asChild>
                      <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 cursor-pointer hover:bg-accent/30 transition-colors">
                        <div>
                          <span className="font-medium text-muted-foreground">{g.name}</span>
                          <span className="block text-xs text-muted-foreground">{g.email}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            £{g.incompleteTotal.toFixed(2)}/mo attempted · never charged
                          </span>
                          {g.statusChips.map((c) => (
                            <Badge key={c.label} variant="outline" className={c.className}>
                              {c.count} {c.label.toLowerCase()}
                            </Badge>
                          ))}
                          <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Child</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead>£/mo</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Attempted</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.rows.map((r) => (
                              <TableRow key={r.key}>
                                <TableCell>{r.childName}</TableCell>
                                <TableCell>
                                  <span>{r.className}</span>
                                  {r.classSchedule && (
                                    <span className="block text-xs text-muted-foreground">{r.classSchedule}</span>
                                  )}
                                </TableCell>
                                <TableCell>£{r.amount.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={r.statusClass}>{r.statusLabel}</Badge>
                                </TableCell>
                                <TableCell>{format(new Date(r.started), "d MMM yyyy")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}

          <MoveMembershipDialog
            target={moveTarget}
            onOpenChange={(o) => { if (!o) setMoveTarget(null); }}
            onMoved={() => setRefreshKey((k) => k + 1)}
          />

          {showOneOff && oneOffSorted.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-off plans</h3>
              <Card className="animate-fade-in">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Child</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Next charge</TableHead>
                        <TableHead>Ends</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oneOffSorted.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell>
                            <span className="font-medium">{r.parentName}</span>
                            <span className="block text-xs text-muted-foreground">{r.parentEmail}</span>
                          </TableCell>
                          <TableCell>{r.childName}</TableCell>
                          <TableCell>
                            <span>{r.className}</span>
                            {r.classSchedule && (
                              <span className="block text-xs text-muted-foreground">{r.classSchedule}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={planMeta[r.plan].className}>{planMeta[r.plan].label}</Badge>
                          </TableCell>
                          <TableCell>
                            £{r.amount.toFixed(2)}
                            {r.perMonth && <span className="text-xs text-muted-foreground">/mo</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.statusClass}>{r.statusLabel}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(r.started), "d MMM yyyy")}</TableCell>
                          <TableCell>{r.nextCharge ? format(new Date(r.nextCharge), "d MMM yyyy") : "—"}</TableCell>
                          <TableCell>{r.ends ? format(new Date(r.ends), "d MMM yyyy") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Admin refund: pick any card-paid booking, choose the amount, and the
  // money goes back to the parent's card via Stripe.
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const openRefund = (b: Booking) => {
    setRefundBooking(b);
    setRefundAmount(b.amount ? Number(b.amount).toFixed(2) : "");
    setRefundReason("");
  };

  const submitRefund = async () => {
    if (!refundBooking) return;
    const pounds = Number(refundAmount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      toast({ title: "Enter a refund amount", description: "The amount must be more than £0.", variant: "destructive" });
      return;
    }
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-refund", {
        body: {
          bookingId: refundBooking.id,
          amountPence: Math.round(pounds * 100),
          reason: refundReason.trim() || undefined,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast({ title: "Refund failed", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: `Refunded £${pounds.toFixed(2)}`,
        description: "The money is on its way back to the parent's card (usually 5–10 working days).",
      });
      setRefundBooking(null);
      fetchBookings();
    } finally {
      setRefunding(false);
    }
  };

  // "Paid for the wrong class" fix: move a booking to another class in place,
  // keeping the child and the payment.
  const [moveBooking, setMoveBooking] = useState<Booking | null>(null);
  const [moveClasses, setMoveClasses] = useState<{ id: string; name: string; class_type: string; day_of_week: string; start_time: string | null }[]>([]);
  const [moveClassId, setMoveClassId] = useState("");
  const [moveSessions, setMoveSessions] = useState<{ id: string; session_date: string; start_time: string }[]>([]);
  const [moveSessionDate, setMoveSessionDate] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  const bookedSessionDate = (b: Booking | null) => /session (\d{4}-\d{2}-\d{2})/.exec(b?.notes || "")?.[1] ?? null;

  const openMove = async (b: Booking) => {
    setMoveBooking(b);
    setMoveClassId("");
    setMoveSessions([]);
    setMoveSessionDate("");
    const { data } = await supabase
      .from("classes")
      .select("id, name, class_type, day_of_week, start_time")
      .eq("is_active", true)
      .order("name");
    setMoveClasses(((data as any[]) ?? []).filter((c) => c.id !== b.class_id));
  };

  // Per-date bookings (trial / drop-in) need a date at the new class too.
  const onMoveClassPicked = async (classId: string) => {
    setMoveClassId(classId);
    setMoveSessionDate("");
    if (!bookedSessionDate(moveBooking)) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time")
      .eq("class_id", classId)
      .eq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date");
    setMoveSessions((data as any[]) ?? []);
  };

  const saveMove = async () => {
    if (!moveBooking || !moveClassId) return;
    const oldDate = bookedSessionDate(moveBooking);
    if (oldDate && !moveSessionDate) {
      toast({ title: "Pick a date", description: "This booking is for a specific session — choose the date at the new class.", variant: "destructive" });
      return;
    }
    setMoveSaving(true);
    let notes = moveBooking.notes ?? "";
    if (oldDate && moveSessionDate) {
      // Point the register at the new date and let the day-before trial
      // reminder send again for it.
      notes = notes.replace(`session ${oldDate}`, `session ${moveSessionDate}`).replace(" | reminder sent", "");
    }
    const { error } = await supabase
      .from("bookings")
      .update({ class_id: moveClassId, notes: notes || null })
      .eq("id", moveBooking.id);
    setMoveSaving(false);
    if (error) {
      toast({ title: "Couldn't move the booking", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Booking moved", description: "The child now appears on the new class's register. The amount already paid is unchanged." });
    setMoveBooking(null);
    fetchBookings();
  };

  const fetchBookings = async () => {
    let query = supabase
      .from("bookings")
      .select("*, classes(name, class_type), students(first_name, last_name)")
      .order("booked_at", { ascending: false });

    if (filter !== "all") query = query.eq("status", filter as "confirmed" | "pending_payment" | "cancelled");

    const { data } = await query;
    if (data) {
      // Fetch parent profiles separately
      const parentIds = [...new Set(data.map((b: any) => b.parent_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", parentIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      
      setBookings(data.map((b: any) => ({ ...b, profiles: profileMap.get(b.parent_id) || null })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Booking updated" }); fetchBookings(); }
  };

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.classes?.name?.toLowerCase().includes(s) ||
      b.students?.first_name?.toLowerCase().includes(s) ||
      b.students?.last_name?.toLowerCase().includes(s) ||
      b.profiles?.full_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Bookings</h1>
        <p className="text-muted-foreground mt-1">Manage all bookings</p>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList className="mb-6">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="passes">Class Passes</TabsTrigger>
          <TabsTrigger value="memberships">Memberships & Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
      <div className="flex gap-4 mb-6">
        <Input placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading bookings...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No bookings found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Card key={b.id} className="animate-fade-in">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{b.classes?.name || "Unknown class"}</span>
                    <Badge variant={statusColors[b.status] || "secondary"}>{b.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {b.students ? `${b.students.first_name} ${b.students.last_name}` : "Adult booking"}
                    {b.profiles && ` — Parent: ${b.profiles.full_name}`}
                    {b.amount && ` — £${b.amount}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Booked: {new Date(b.booked_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {b.status === "pending_payment" && (
                    <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")}>Confirm</Button>
                  )}
                  {b.status === "confirmed" && b.class_id && MOVABLE_TYPES.includes(b.booking_type) && (
                    <Button size="sm" variant="outline" onClick={() => openMove(b)}>Move class</Button>
                  )}
                  {Number(b.amount) > 0 && /pi_[A-Za-z0-9]+/.test(b.notes || "") && !/refunded £/.test(b.notes || "") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openRefund(b)}
                    >
                      Refund
                    </Button>
                  )}
                  {b.status !== "cancelled" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "cancelled")}>Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="passes">
          <ClassPassesTab />
        </TabsContent>

        <TabsContent value="memberships">
          <MembershipsTab />
        </TabsContent>
      </Tabs>

      {/* Refund a card-paid booking (partial or full) */}
      <Dialog open={!!refundBooking} onOpenChange={(o) => { if (!o && !refunding) setRefundBooking(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund this booking</DialogTitle>
            <DialogDescription>
              {refundBooking?.classes?.name || "Booking"}
              {refundBooking?.students && ` — ${refundBooking.students.first_name} ${refundBooking.students.last_name}`}
              {refundBooking?.profiles && ` (${refundBooking.profiles.full_name})`}.
              The money goes straight back to the card that paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Amount to refund (£)</p>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
              {refundBooking?.amount != null && (
                <p className="text-xs text-muted-foreground">
                  This booking cost £{Number(refundBooking.amount).toFixed(2)} — you can refund part
                  or all of it.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional, kept on the payment record)</span></p>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. cancelled 1:1 session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={refunding} onClick={() => setRefundBooking(null)}>Cancel</Button>
            <Button variant="destructive" disabled={refunding} onClick={submitRefund}>
              {refunding ? "Refunding…" : `Refund £${Number(refundAmount || 0) > 0 ? Number(refundAmount).toFixed(2) : "0.00"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move a paid booking to another class (wrong-class fix) */}
      <Dialog open={!!moveBooking} onOpenChange={(o) => !o && setMoveBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move booking to another class</DialogTitle>
            <DialogDescription>
              {moveBooking?.students
                ? `${moveBooking.students.first_name} ${moveBooking.students.last_name}`
                : "This booking"}{" "}
              — currently {moveBooking?.classes?.name ?? "unassigned"}. The child and the amount
              already paid stay exactly as they are; only the class changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">New class</p>
              <Select value={moveClassId} onValueChange={onMoveClassPicked}>
                <SelectTrigger><SelectValue placeholder="Choose a class..." /></SelectTrigger>
                <SelectContent>
                  {moveClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1)}
                      {c.start_time ? ` ${c.start_time.slice(0, 5)}` : ""}
                      {` (${c.class_type === "children" ? "Children" : "Adults"})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bookedSessionDate(moveBooking) && moveClassId && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">New session date</p>
                {moveSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming sessions at that class — pick a different one.</p>
                ) : (
                  <Select value={moveSessionDate} onValueChange={setMoveSessionDate}>
                    <SelectTrigger><SelectValue placeholder="Choose a date..." /></SelectTrigger>
                    <SelectContent>
                      {moveSessions.map((s) => (
                        <SelectItem key={s.id} value={s.session_date}>
                          {format(new Date(s.session_date + "T00:00:00"), "EEE d MMM yyyy")} · {s.start_time?.slice(0, 5)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {moveBooking?.booking_type === "term" && (
              <p className="text-xs text-muted-foreground">
                Termly booking: if the new class has a different price, settle any difference with
                the parent separately — the system won't charge or refund on a move.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveBooking(null)}>Cancel</Button>
            <Button onClick={saveMove} disabled={moveSaving || !moveClassId}>
              {moveSaving ? "Moving..." : "Move booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookings;
