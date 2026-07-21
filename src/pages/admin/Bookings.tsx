import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck } from "lucide-react";
import { FadeRise, Stagger } from "@/components/motion";

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

const statusVariants: Record<string, "success" | "warning" | "destructive"> = {
  confirmed: "success",
  pending_payment: "warning",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending payment",
  cancelled: "Cancelled",
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
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <FadeRise>
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage all bookings</p>
        </div>
      </FadeRise>

      <FadeRise delay={60}>
        <div className="flex gap-3 mb-6 flex-wrap">
          <Input placeholder="Search bookings…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="pending_payment">Pending payment</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FadeRise>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <FadeRise>
          <Card><CardContent className="py-12 text-center text-muted-foreground">No bookings found.</CardContent></Card>
        </FadeRise>
      ) : (
        <Stagger className="space-y-3" step={60}>
          {filtered.map((b) => (
            <Card key={b.id} className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
              <CardContent className="flex items-center justify-between gap-4 p-4 md:p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{b.classes?.name || "Unknown class"}</span>
                      <Badge variant={statusVariants[b.status] || "secondary"}>
                        {statusLabels[b.status] ?? b.status.replace("_", " ")}
                      </Badge>
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
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
        </Stagger>
      )}
    </div>
  );
};

export default AdminBookings;
