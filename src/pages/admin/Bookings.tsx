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
import { useToast } from "@/hooks/use-toast";
import { ADULT_PASSES, type AdultPassType } from "@/lib/pricing";

interface Booking {
  id: string;
  status: string;
  booking_type: string;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  classes: { name: string; class_type: string } | null;
  students: { first_name: string; last_name: string } | null;
  profiles: { full_name: string; email: string } | null;
}

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

const AdminBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      </Tabs>
    </div>
  );
};

export default AdminBookings;
