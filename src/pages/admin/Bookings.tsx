import { useEffect, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subDays } from "date-fns";
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
import { AlertCircle, ChevronDown, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { passLabelOf, usePassCatalog } from "@/lib/passCatalog";
import MoveMembershipDialog, { type MoveMembershipTarget } from "@/components/admin/MoveMembershipDialog";
import MembershipAdjustDialog, { type AdjustableMembership } from "@/components/admin/MembershipAdjustDialog";
import OneToOneTab from "@/components/admin/OneToOneTab";
import TrialsTab from "@/components/admin/TrialsTab";
import AddBookingDialog from "@/components/admin/AddBookingDialog";
import BookingBreakdown, { type PaymentSibling } from "@/components/admin/BookingBreakdown";
import { BookingActions } from "@/components/admin/BookingActions";
import { useBookingActions } from "@/components/admin/useBookingActions";
import { paymentRefOf } from "@/lib/bookingBreakdown";
import { Chip, ChipRow } from "@/components/booking/Chips";
import { EmptyState } from "@/components/booking/EmptyState";
import { StatusPill, TonePill, planLabel } from "@/components/admin/StatusPill";

interface Booking {
  id: string;
  status: string;
  booking_type: string;
  class_id: string | null;
  camp_id?: string | null;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  classes: {
    name: string;
    class_type: "children" | "adult";
    start_time: string | null;
    end_time: string | null;
    price_per_session: number | null;
    price_per_term: number | null;
    price_per_month: number | null;
    price_per_year: number | null;
    term_end: string | null;
  } | null;
  students: { first_name: string; last_name: string } | null;
  profiles: { full_name: string; email: string; phone?: string | null } | null;
  camps?: { name: string } | null;
}

const BOOKING_TABS = [
  { id: "bookings", label: "Bookings" },
  { id: "trials", label: "Trials" },
  { id: "one-to-ones", label: "One-to-ones" },
  { id: "passes", label: "Class Passes" },
  { id: "memberships", label: "Memberships & Plans" },
];

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "pending_payment", label: "Awaiting payment" },
  { id: "cancelled", label: "Cancelled" },
];

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

/** How far back a pass can be used for a class that has already run — the
 *  member turned up without booking on, and the studio records it after. */
const PASS_RECORD_LOOKBACK_DAYS = 42;
const PASS_RECORD_LOOKAHEAD_DAYS = 28;

interface AdultClassOption {
  id: string;
  name: string;
  day_of_week: string | null;
  start_time: string | null;
  venues: { name: string } | null;
}

/** Admin view of every customer's multi-class pass: credits left and validity. */
const ClassPassesTab = () => {
  const [passes, setPasses] = useState<ClassPass[]>([]);
  const [loading, setLoading] = useState(true);
  const { passes: passCatalog } = usePassCatalog();
  const { toast } = useToast();

  // "Record a class": use one of the pass's classes for a date they came to
  // (usually one that has already run) without booking on.
  const [recordFor, setRecordFor] = useState<ClassPass | null>(null);
  const [adultClasses, setAdultClasses] = useState<AdultClassOption[]>([]);
  const [recordClassId, setRecordClassId] = useState("");
  const [recordDates, setRecordDates] = useState<{ id: string; session_date: string }[]>([]);
  const [recordDate, setRecordDate] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [recordSaving, setRecordSaving] = useState(false);

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

  useEffect(() => {
    void fetchPasses();
  }, []);

  const openRecord = async (p: ClassPass) => {
    setRecordFor(p);
    setRecordClassId("");
    setRecordDates([]);
    setRecordDate("");
    setRecordNote("");
    if (adultClasses.length === 0) {
      // Passes only ever cover adult classes; a 1:1 slot is never one of them.
      const { data } = await supabase
        .from("classes")
        .select("id, name, day_of_week, start_time, venues:venue_id(name)")
        .eq("is_active", true)
        .eq("class_type", "adult")
        .neq("invite_only", true)
        .order("name");
      setAdultClasses(((data as any[]) ?? []) as AdultClassOption[]);
    }
  };

  const onRecordClassPicked = async (classId: string) => {
    setRecordClassId(classId);
    setRecordDate("");
    const today = new Date();
    const { data } = await supabase
      .from("class_sessions")
      .select("id, session_date")
      .eq("class_id", classId)
      .neq("status", "cancelled")
      .gte("session_date", format(subDays(today, PASS_RECORD_LOOKBACK_DAYS), "yyyy-MM-dd"))
      .lte("session_date", format(addDays(today, PASS_RECORD_LOOKAHEAD_DAYS), "yyyy-MM-dd"))
      .order("session_date", { ascending: false });
    setRecordDates(((data as any[]) ?? []) as { id: string; session_date: string }[]);
  };

  const saveRecord = async () => {
    if (!recordFor || !recordClassId || !recordDate) return;
    setRecordSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-book", {
        body: {
          mode: "redeem_pass",
          userId: recordFor.user_id,
          passId: recordFor.id,
          classId: recordClassId,
          sessionDate: recordDate,
          note: recordNote.trim() || null,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.error) message = b.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast({ title: "Couldn't record that class", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      const left = Number(data.remaining);
      toast({
        title: "Class recorded",
        description: `One class taken off the pass — ${Number.isFinite(left) ? left : "?"} left. They're on that date's register.`,
      });
      setRecordFor(null);
      await fetchPasses();
    } finally {
      setRecordSaving(false);
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

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
          {/* Phone: one card per pass, with what's left shown as a bar. */}
          <div className="divide-y divide-border/70 md:hidden">
            {sorted.map((p) => {
              const status = passStatus(p);
              const badge = passStatusBadge[status];
              const expiryDate = new Date(p.expires_at);
              const isExpired = expiryDate.getTime() < Date.now();
              const daysLeft = differenceInCalendarDays(expiryDate, new Date());
              const used = Math.max(0, p.sessions_total - p.sessions_remaining);
              const pct = p.sessions_total > 0 ? Math.round((used / p.sessions_total) * 100) : 0;
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.profile?.full_name || "Unknown"}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.profile?.email || "—"}</p>
                    </div>
                    <TonePill tone={status === "active" ? "success" : "neutral"}>{badge.label}</TonePill>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{passLabelOf(passCatalog, p.pass_type)}</span>
                    <span className="shrink-0 tabular-nums">
                      <strong>{p.sessions_remaining}</strong>
                      <span className="text-muted-foreground"> of {p.sessions_total} left</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className={`h-full rounded-full ${status === "active" ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Bought {format(new Date(p.purchased_at), "d MMM")} · £{Number(p.amount_paid).toFixed(2)}</span>
                    <span className={isExpired ? "text-destructive" : undefined}>
                      {isExpired ? `Expired ${format(expiryDate, "d MMM")}` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                    </span>
                  </div>
                  {p.sessions_remaining > 0 && (
                    <Button variant="outline" className="mt-3 h-11 w-full rounded-full" onClick={() => void openRecord(p)}>
                      Record a class
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="hidden md:block">
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
                <TableHead className="text-right"></TableHead>
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
                    <TableCell>{passLabelOf(passCatalog, p.pass_type)}</TableCell>
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
                    <TableCell className="text-right">
                      {p.sessions_remaining > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="whitespace-nowrap"
                          onClick={() => void openRecord(p)}
                        >
                          Record a class
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* They came to a class on this pass but never booked on: take a class
          off the pass and put them on that date's register. */}
      <Dialog open={!!recordFor} onOpenChange={(o) => { if (!o && !recordSaving) setRecordFor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record a class on this pass</DialogTitle>
            <DialogDescription>
              {recordFor?.profile?.full_name || "This member"} came to a class without booking on.
              One class comes off the pass ({recordFor?.sessions_remaining ?? 0} left) and they go on that
              date's register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Class</label>
              <Select value={recordClassId} onValueChange={(v) => void onRecordClassPicked(v)}>
                <SelectTrigger><SelectValue placeholder="Choose the class they came to" /></SelectTrigger>
                <SelectContent>
                  {adultClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.day_of_week ? ` — ${c.day_of_week}` : ""}
                      {c.start_time ? ` ${c.start_time.slice(0, 5)}` : ""}
                      {c.venues?.name ? ` · ${c.venues.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recordClassId && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                {recordDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dates for this class in the last few weeks.</p>
                ) : (
                  <Select value={recordDate} onValueChange={setRecordDate}>
                    <SelectTrigger><SelectValue placeholder="Pick the date they came" /></SelectTrigger>
                    <SelectContent>
                      {recordDates.map((s) => (
                        <SelectItem key={s.id} value={s.session_date}>
                          {format(parseISO(s.session_date), "EEE d MMM yyyy")}
                          {s.session_date < today ? " — already run" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note (optional)</label>
              <Input
                value={recordNote}
                onChange={(e) => setRecordNote(e.target.value)}
                placeholder="e.g. forgot to book on"
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordFor(null)} disabled={recordSaving}>Cancel</Button>
            <Button onClick={() => void saveRecord()} disabled={recordSaving || !recordClassId || !recordDate}>
              {recordSaving ? "Recording…" : "Take a class off the pass"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  free_month: number | null;
  students: { first_name: string; last_name: string } | null;
  classes: { name: string; day_of_week: string | null; start_time: string | null } | null;
  profile: { full_name: string; email: string } | null;
}

/** A one-off change to a single month's membership payment (money off or
 *  extra) that hasn't been removed — shown as a badge on the row. */
interface RowAdjustment {
  membership_id: string;
  billing_month: string;
  amount: number;
}

/** "YYYY-MM" of the month a payment date falls in (payments land ~07:00 UTC on the 5th). */
const paymentMonthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** "−£7 off Feb" / "+£5 extra Feb" — whole pounds stay whole. */
const adjustmentBadgeLabel = (a: RowAdjustment) => {
  const abs = Math.abs(a.amount);
  const pounds = Number.isInteger(abs) ? `£${abs}` : `£${abs.toFixed(2)}`;
  const [y, m] = a.billing_month.split("-").map(Number);
  const month = format(new Date(y, m - 1, 1), "MMM");
  return a.amount < 0 ? `−${pounds} off ${month}` : `+${pounds} extra ${month}`;
};

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
  /** Raw memberships.status / free_month — for the "Adjust payment" dialog. */
  membershipStatus: string | null;
  freeMonth: number | null;
  /**
   * The payment date has passed and nothing rolled the membership forward, so
   * this month has not been paid. Derived from the dates rather than read from
   * memberships.status: the nightly job that sets 'past_due' runs before
   * Stripe raises the invoices, so a failure on the 5th is not in the status
   * column until the following morning.
   */
  paymentOverdue: boolean;
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
  const [adjustTarget, setAdjustTarget] = useState<AdjustableMembership | null>(null);
  // Upcoming one-off payment changes, keyed by membership id.
  const [adjustmentsByMembership, setAdjustmentsByMembership] = useState<Map<string, RowAdjustment[]>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPlans = async () => {
      const [membershipsRes, bookingsRes] = await Promise.all([
        supabase
          .from("memberships")
          .select("id, user_id, class_id, monthly_amount, status, started_at, current_period_end, cancel_at, free_month, students(first_name, last_name), classes(name, day_of_week, start_time)")
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

      // One-off payment changes for this month onwards, one query for every
      // membership listed — past months no longer matter for the row badge.
      const membershipIds = memberships.map((m) => m.id);
      const { data: adjustments } = membershipIds.length > 0
        ? await supabase
            .from("membership_adjustments")
            .select("membership_id, billing_month, amount")
            .in("membership_id", membershipIds)
            .neq("status", "removed")
            .gte("billing_month", format(startOfMonth(new Date()), "yyyy-MM-dd"))
            .order("billing_month")
        : { data: [] };
      const adjMap = new Map<string, RowAdjustment[]>();
      for (const a of adjustments ?? []) {
        const row = { ...a, amount: Number(a.amount) };
        const list = adjMap.get(a.membership_id);
        if (list) list.push(row);
        else adjMap.set(a.membership_id, [row]);
      }
      setAdjustmentsByMembership(adjMap);

      const schedule = (cls: { day_of_week: string | null; start_time: string | null } | null) =>
        cls?.day_of_week
          ? `${cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)}${cls.start_time ? ` ${cls.start_time.slice(0, 5)}` : ""}`
          : null;

      const isLive = (s: string) => s === "active" || s === "past_due" || s === "cancel_scheduled";

      const nowMs = Date.now();
      const membershipRows: PlanRow[] = memberships.map((m) => {
        const profile = profileMap.get(m.user_id);
        const overdue =
          isLive(m.status) &&
          !!m.current_period_end &&
          new Date(m.current_period_end).getTime() < nowMs;
        const badge = overdue
          ? { label: "Not paid", className: "border-transparent bg-destructive text-destructive-foreground" }
          : membershipBadge[m.status] ?? { label: m.status, className: "" };
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
          membershipStatus: m.status,
          freeMonth: m.free_month ?? null,
          paymentOverdue: overdue,
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
          membershipStatus: null,
          freeMonth: null,
          paymentOverdue: false,
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

  // What a membership row can have done to it, and the one-off payment
  // changes still to come — shared by the phone card and the desktop table.
  const rowExtras = (r: PlanRow) => {
    // Only payments not yet taken: once the 5th has been charged, that
    // month's adjustment is history.
    const nextChargeKey = r.nextCharge ? paymentMonthKey(r.nextCharge) : null;
    const rowAdjustments = (r.membershipId ? adjustmentsByMembership.get(r.membershipId) ?? [] : [])
      .filter((a) => !nextChargeKey || a.billing_month.slice(0, 7) >= nextChargeKey);
    const canMove = !!r.membershipId && (r.statusLabel === "Active" || r.statusLabel === "Paused");
    const canAdjust =
      !!r.membershipId &&
      (r.statusLabel === "Active" || r.statusLabel === "Paused" || r.statusLabel === "Payment issue");
    return { rowAdjustments, canMove, canAdjust };
  };
  const openMoveFor = (r: PlanRow) => setMoveTarget({
    membershipId: r.membershipId!,
    parentName: r.parentName,
    childName: r.childName,
    className: r.className,
    classId: r.classId,
  });
  const openAdjustFor = (r: PlanRow) => setAdjustTarget({
    id: r.membershipId!,
    monthly_amount: r.amount,
    current_period_end: r.nextCharge,
    free_month: r.freeMonth,
    className: r.className,
    studentName: r.childName !== "—" ? r.childName : null,
    status: r.membershipStatus ?? "",
  });
  const adjustmentBadge = (a: RowAdjustment) => (
    <Badge
      key={a.billing_month}
      variant="outline"
      className={`w-fit text-[10px] whitespace-nowrap ${
        a.amount < 0
          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/40 text-amber-600 dark:text-amber-400"
      }`}
    >
      {adjustmentBadgeLabel(a)}
    </Badge>
  );

  const showMonthly = planFilter === "all" || planFilter === "monthly";
  const showOneOff = planFilter !== "monthly";
  const nothingToShow =
    (!showMonthly || familyGroups.length === 0) && (!showOneOff || oneOffSorted.length === 0);

  if (loading) return <div className="text-muted-foreground">Loading plans...</div>;
  if (rows.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No memberships or plan purchases yet.</CardContent></Card>;
  }

  // Families whose payment date has passed with nothing taken. Surfaced at the
  // top because a place is only held once the month is paid for.
  const unpaidFamilies = [...familyGroups]
    .map((g) => {
      const overdue = g.rows.filter((r) => r.paymentOverdue);
      return {
        name: g.name,
        email: g.email,
        owed: overdue.reduce((n, r) => n + r.amount, 0),
        children: [...new Set(overdue.map((r) => r.childName).filter((c) => c && c !== "—"))],
        since: overdue.map((r) => r.nextCharge).filter(Boolean).sort()[0] ?? null,
        count: overdue.length,
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.owed - a.owed);
  const totalOwed = unpaidFamilies.reduce((n, f) => n + f.owed, 0);

  return (
    <div className="space-y-4">
      {unpaidFamilies.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="font-semibold text-destructive">
                  {unpaidFamilies.length} famil{unpaidFamilies.length === 1 ? "y has" : "ies have"} not paid this month
                  {" "}— £{totalOwed.toFixed(2)} outstanding
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Their payment date has passed and nothing has been taken. A place isn&#39;t held until
                  the month is paid, so check with them before the next class.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {unpaidFamilies.map((f) => (
                <div key={f.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background px-3 py-2">
                  <span className="font-medium">{f.name}</span>
                  <span className="font-semibold tabular-nums text-destructive">£{f.owed.toFixed(2)}</span>
                  {f.children.length > 0 && (
                    <span className="text-sm text-muted-foreground">{f.children.join(", ")}</span>
                  )}
                  {f.since && (
                    <span className="text-xs text-muted-foreground">due {format(new Date(f.since), "d MMM")}</span>
                  )}
                  <a
                    href={`mailto:${f.email}`}
                    className="min-w-0 break-all text-sm text-primary hover:underline sm:ml-auto"
                  >
                    {f.email}
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        {monthlyStats.activeCount} live monthly membership{monthlyStats.activeCount === 1 ? "" : "s"} · £
        {monthlyStats.recurring.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month recurring
        {monthlyStats.pausedCount > 0 && (
          <span className="block text-xs mt-0.5">
            {monthlyStats.pausedCount} paused for the August break — no payments this month, everything resumes automatically on 1 September.
          </span>
        )}
      </p>

      <div className="space-y-3">
        <div className="relative md:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search parent, child or class"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-full pl-10"
            aria-label="Search plans"
          />
        </div>
        <ChipRow>
          <Chip selected={planFilter === "all"} onClick={() => setPlanFilter("all")} trailing={rows.length}>
            All
          </Chip>
          {PLAN_ORDER.filter((p) => counts[p] > 0).map((p) => (
            <Chip key={p} selected={planFilter === p} onClick={() => setPlanFilter(p)} trailing={counts[p]}>
              {planMeta[p].label}
            </Chip>
          ))}
        </ChipRow>
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
                        {/* Phone: one block per membership with its two actions
                            as full-width buttons. */}
                        <div className="divide-y divide-border/70 md:hidden">
                          {g.rows.map((r) => {
                            const { rowAdjustments, canMove, canAdjust } = rowExtras(r);
                            return (
                              <div key={r.key} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">{r.childName}</p>
                                    <p className="truncate text-sm text-muted-foreground">
                                      {r.className}
                                      {r.classSchedule && ` · ${r.classSchedule}`}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="font-semibold tabular-nums">
                                      £{r.amount.toFixed(2)}
                                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                                    </p>
                                    <Badge variant="outline" className={`mt-1 ${r.statusClass}`}>{r.statusLabel}</Badge>
                                  </div>
                                </div>
                                {rowAdjustments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">{rowAdjustments.map(adjustmentBadge)}</div>
                                )}
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Started {format(new Date(r.started), "d MMM yyyy")}
                                  {r.nextCharge && ` · Next charge ${format(new Date(r.nextCharge), "d MMM")}`}
                                  {r.ends && ` · Ends ${format(new Date(r.ends), "d MMM yyyy")}`}
                                </p>
                                {(canMove || canAdjust) && (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    {canMove && (
                                      <Button variant="outline" className="h-10 rounded-full" onClick={() => openMoveFor(r)}>
                                        Move class
                                      </Button>
                                    )}
                                    {canAdjust && (
                                      <Button
                                        variant="outline"
                                        className={`h-10 rounded-full ${canMove ? "" : "col-span-2"}`}
                                        onClick={() => openAdjustFor(r)}
                                      >
                                        Adjust payment
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="hidden md:block">
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
                            {g.rows.map((r) => {
                              const { rowAdjustments, canMove, canAdjust } = rowExtras(r);
                              return (
                              <TableRow key={r.key}>
                                <TableCell>{r.childName}</TableCell>
                                <TableCell>
                                  <span>{r.className}</span>
                                  {r.classSchedule && (
                                    <span className="block text-xs text-muted-foreground">{r.classSchedule}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  £{r.amount.toFixed(2)}
                                  {rowAdjustments.length > 0 && (
                                    <div className="mt-1 flex flex-col gap-1">{rowAdjustments.map(adjustmentBadge)}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={r.statusClass}>{r.statusLabel}</Badge>
                                </TableCell>
                                <TableCell>{format(new Date(r.started), "d MMM yyyy")}</TableCell>
                                <TableCell>{r.nextCharge ? format(new Date(r.nextCharge), "d MMM yyyy") : "—"}</TableCell>
                                <TableCell>{r.ends ? format(new Date(r.ends), "d MMM yyyy") : "—"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    {canMove && (
                                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMoveFor(r)}>
                                        Move
                                      </Button>
                                    )}
                                    {canAdjust && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs whitespace-nowrap"
                                        onClick={() => openAdjustFor(r)}
                                      >
                                        Adjust payment
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        </div>
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
                      <div className="overflow-x-auto border-t border-border">
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

          {/* Take money off (or add extra to) one month's payment */}
          <MembershipAdjustDialog
            open={!!adjustTarget}
            onOpenChange={(o) => { if (!o) setAdjustTarget(null); }}
            membership={adjustTarget}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />

          {showOneOff && oneOffSorted.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-off plans</h3>
              <Card className="animate-fade-in">
                <CardContent className="p-0">
                  <div className="divide-y divide-border/70 md:hidden">
                    {oneOffSorted.map((r) => (
                      <div key={r.key} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{r.childName !== "—" ? r.childName : r.parentName}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {r.className}
                              {r.classSchedule && ` · ${r.classSchedule}`}
                            </p>
                            {r.childName !== "—" && (
                              <p className="truncate text-xs text-muted-foreground">{r.parentName}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold tabular-nums">£{r.amount.toFixed(2)}</p>
                            <Badge variant="outline" className={`mt-1 ${planMeta[r.plan].className}`}>{planMeta[r.plan].label}</Badge>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {r.statusLabel} · {format(new Date(r.started), "d MMM yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
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
                  </div>
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
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState("bookings");

  // Bumped whenever an action changes a booking, so the Trials and
  // One-to-ones tabs reload the row they just acted on.
  const [changeToken, setChangeToken] = useState(0);
  const bookingsChanged = () => { fetchBookings(); setChangeToken((n) => n + 1); };

  // One set of row actions and their dialogs, shared by the Bookings, Trials
  // and One-to-ones tabs and by each class session's own page, so every
  // booking offers the same things wherever it is listed.
  const { actions: bookingActions, dialogs: bookingDialogs } = useBookingActions({ onChanged: bookingsChanged });
  const breakdownId = bookingActions.breakdownId;

  // Every booking paid in the same Stripe payment as this one — so the panel
  // can show the whole checkout (both siblings, all classes) in one place.
  const paymentSiblings = (b: { id: string; notes: string | null; students?: { first_name: string; last_name: string } | null; classes?: { name: string } | null; booking_type: string; amount: number | null }): PaymentSibling[] => {
    const ref = paymentRefOf(b.notes);
    const group = ref ? bookings.filter((o) => paymentRefOf(o.notes) === ref) : [b];
    return group.map((o) => ({
      id: o.id,
      studentName: o.students ? `${o.students.first_name} ${o.students.last_name}` : "Adult",
      className: o.classes?.name ?? "Booking",
      plan: o.booking_type,
      amount: Number(o.amount ?? 0),
    }));
  };

  const fetchBookings = async () => {
    // Always load every booking and filter below: the breakdown groups a
    // booking with the others paid for in the same Stripe payment, and those
    // siblings can be trials or cancelled rows the status filter would hide.
    const query = supabase
      .from("bookings")
      .select("*, classes(name, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, term_end), students(first_name, last_name), camps:camp_id(name)")
      .order("booked_at", { ascending: false });

    const { data } = await query;
    if (data) {
      // Fetch parent profiles separately
      const parentIds = [...new Set(data.map((b: any) => b.parent_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", parentIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      setBookings(data.map((b: any) => ({ ...b, profiles: profileMap.get(b.parent_id) || null })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, []);

  const filtered = bookings.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.classes?.name?.toLowerCase().includes(s) ||
      b.students?.first_name?.toLowerCase().includes(s) ||
      b.students?.last_name?.toLowerCase().includes(s) ||
      b.profiles?.full_name?.toLowerCase().includes(s)
    );
  });

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 pb-28 md:p-8">
      <div className="mb-5 flex items-start justify-between gap-4 md:mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold md:text-3xl">Bookings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground md:mt-1 md:text-base">Manage all bookings</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="hidden md:inline-flex">
          <Plus className="w-4 h-4 mr-1.5" /> Add booking
        </Button>
      </div>

      {/* On a phone the one thing you come here to do sits in thumb reach. */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="pressable fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 md:hidden"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-5 w-5" /> Add booking
      </button>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Phone: a row of chips that scrolls sideways; desktop: the tab bar. */}
        <ChipRow className="mb-4 md:hidden">
          {BOOKING_TABS.map((t) => (
            <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
          ))}
        </ChipRow>
        <TabsList className="mb-6 hidden md:inline-flex">
          {BOOKING_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="bookings">
          <div className="mb-4 space-y-3 md:mb-6">
            <div className="relative md:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search dancer, parent or class"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-full pl-10"
                aria-label="Search bookings"
              />
            </div>
            <ChipRow>
              {STATUS_FILTERS.map((f) => (
                <Chip
                  key={f.id}
                  selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  trailing={f.id === "all" ? bookings.length : (statusCounts[f.id] ?? 0)}
                >
                  {f.label}
                </Chip>
              ))}
            </ChipRow>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No bookings here"
              body={search ? "Nothing matches that search — try a dancer, a parent or a class." : "Nothing with this status yet."}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => {
                const dancer = b.students ? `${b.students.first_name} ${b.students.last_name}` : "Adult booking";
                const parent = b.profiles?.full_name;
                return (
                  <Card key={b.id} className="animate-fade-in overflow-hidden">
                    <CardContent className="p-4 md:p-5">
                      {/* Phone: details and actions run along the bottom of the
                          card; desktop: the actions sit on the right. */}
                      <div className="flex flex-wrap items-start gap-3 md:items-center">
                        <div className="min-w-0 flex-1 basis-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">{b.classes?.name || b.camps?.name || "Unknown class"}</span>
                            <StatusPill status={b.status} />
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {dancer}
                            {parent && parent !== dancer && ` · ${parent}`}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {planLabel(b.booking_type)} · booked {format(new Date(b.booked_at), "d MMM, HH:mm")}
                          </p>
                        </div>
                        {b.amount != null && (
                          <span className="shrink-0 font-semibold tabular-nums">£{Number(b.amount).toFixed(2)}</span>
                        )}
                        {breakdownId === b.id && (
                          <div className="order-3 basis-full md:order-4">
                            <BookingBreakdown
                              booking={b as any}
                              parent={b.profiles}
                              samePayment={paymentSiblings(b)}
                            />
                          </div>
                        )}
                        <div className="order-4 basis-full md:order-3 md:ml-1 md:basis-auto">
                          <BookingActions booking={b} actions={bookingActions} className="mt-0" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trials">
          <TrialsTab actions={bookingActions} paymentSiblings={paymentSiblings} changeToken={changeToken} />
        </TabsContent>

        <TabsContent value="one-to-ones">
          <OneToOneTab actions={bookingActions} paymentSiblings={paymentSiblings} changeToken={changeToken} />
        </TabsContent>

        <TabsContent value="passes">
          <ClassPassesTab />
        </TabsContent>

        <TabsContent value="memberships">
          <MembershipsTab />
        </TabsContent>
      </Tabs>

      {/* Put someone on a class by hand: record a Gymcatch/cash purchase, or
          set the place up and email them a link to pay for it. */}
      <AddBookingDialog open={addOpen} onOpenChange={setAddOpen} onDone={fetchBookings} />

      {bookingDialogs}
    </div>
  );
};

export default AdminBookings;
