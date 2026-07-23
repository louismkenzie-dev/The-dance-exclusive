import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, ChevronDown, ChevronRight, Mail, Phone, Baby, ExternalLink, MapPin, Calendar, ShoppingBag, ShieldCheck, Pencil, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import CustomerEditDialog from "@/components/admin/CustomerEditDialog";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  secondary_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  created_at: string;
}

type SortMode = "name" | "paid_desc" | "newest" | "oldest";

const AdminCustomers = () => {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editingChild, setEditingChild] = useState<any | null>(null);

  const { data: profiles, isLoading: loadingProfiles, refetch: refetchProfiles } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data as Profile[]).filter((p) => !adminIds.has(p.user_id));
    },
  });

  const { data: students, refetch: refetchStudents } = useQuery({
    queryKey: ["admin-customers-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("first_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-customers-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, parent_id, status, amount, booked_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: passes } = useQuery({
    queryKey: ["admin-customers-passes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_passes").select("user_id, amount_paid, created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: collectors } = useQuery({
    queryKey: ["admin-customers-collectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("authorized_collectors").select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const studentsByParent = (students || []).reduce<Record<string, any[]>>((acc, s) => {
    if (!acc[s.parent_id]) acc[s.parent_id] = [];
    acc[s.parent_id].push(s);
    return acc;
  }, {});

  const bookingsByParent = (bookings || []).reduce<Record<string, any[]>>((acc, b) => {
    if (!acc[b.parent_id]) acc[b.parent_id] = [];
    acc[b.parent_id].push(b);
    return acc;
  }, {});

  const collectorsByParent = (collectors || []).reduce<Record<string, any[]>>((acc, c) => {
    if (!acc[c.parent_id]) acc[c.parent_id] = [];
    acc[c.parent_id].push(c);
    return acc;
  }, {});

  // Total actually paid this calendar year: confirmed bookings + class passes.
  const currentYear = new Date().getFullYear();
  const paidThisYearByParent: Record<string, number> = {};
  for (const b of bookings || []) {
    if (b.status !== "confirmed" || !b.parent_id) continue;
    if (b.booked_at && new Date(b.booked_at).getFullYear() !== currentYear) continue;
    paidThisYearByParent[b.parent_id] = (paidThisYearByParent[b.parent_id] || 0) + Number(b.amount || 0);
  }
  for (const p of passes || []) {
    if (!p.user_id) continue;
    if (p.created_at && new Date(p.created_at).getFullYear() !== currentYear) continue;
    paidThisYearByParent[p.user_id] = (paidThisYearByParent[p.user_id] || 0) + Number(p.amount_paid || 0);
  }

  const filtered = (profiles || [])
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
      );
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "paid_desc":
          return (paidThisYearByParent[b.user_id] || 0) - (paidThisYearByParent[a.user_id] || 0);
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return a.full_name.localeCompare(b.full_name);
      }
    });

  const calcAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const formatAddress = (p: Profile) => {
    return [p.address_line1, p.address_line2, p.city, p.county, p.postcode].filter(Boolean).join(", ");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Parent accounts and their registered children
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.open("/auth", "_blank")} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            Registration Page
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-56">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="paid_desc">Total paid this year (high → low)</SelectItem>
            <SelectItem value="newest">Newest customers first</SelectItem>
            <SelectItem value="oldest">Oldest customers first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingProfiles ? (
            <div className="p-4 md:p-8 text-center text-muted-foreground animate-pulse">Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 md:p-8 text-center text-muted-foreground">No customers found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Children</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Paid ({currentYear})</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => {
                  const children = studentsByParent[customer.user_id] || [];
                  const custBookings = bookingsByParent[customer.user_id] || [];
                  const custCollectors = collectorsByParent[customer.user_id] || [];
                  const isExpanded = expandedCustomer === customer.user_id;
                  const address = formatAddress(customer);
                  return (
                    <>
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedCustomer(isExpanded ? null : customer.user_id)}
                      >
                        <TableCell className="w-8 pr-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{customer.full_name}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            {customer.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {customer.phone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={children.length > 0 ? "default" : "outline"} className="min-w-[2rem]">
                            {children.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={custBookings.length > 0 ? "secondary" : "outline"} className="min-w-[2rem]">
                            {custBookings.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(paidThisYearByParent[customer.user_id] || 0) > 0
                            ? `£${(paidThisYearByParent[customer.user_id] || 0).toFixed(2)}`
                            : <span className="text-muted-foreground font-normal">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(customer.created_at), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${customer.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell></TableCell>
                          <TableCell colSpan={7} className="py-4">
                            <div className="space-y-5">
                              {/* Contact & Address */}
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Details</h4>
                                  <div className="text-sm space-y-1">
                                    <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {customer.email}</p>
                                    <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.phone || "No phone"}</p>
                                    {customer.secondary_phone && (
                                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.secondary_phone} <span className="text-xs text-muted-foreground">(secondary)</span></p>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Address</h4>
                                  <p className="text-sm">{address || <span className="text-muted-foreground">No address on file</span>}</p>
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mt-3"><Calendar className="h-3.5 w-3.5" /> Account</h4>
                                  <p className="text-sm">Joined {format(new Date(customer.created_at), "d MMMM yyyy")}</p>
                                </div>
                              </div>

                              {/* Children */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <Baby className="h-3.5 w-3.5" /> Children ({children.length})
                                </h4>
                                {children.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No children registered</p>
                                ) : (
                                  <div className="grid gap-2">
                                    {children.map((child: any) => (
                                      <div key={child.id} className="flex items-center gap-3 bg-background rounded-lg px-4 py-3 border">
                                        {child.profile_photo ? (
                                          <img src={child.profile_photo} alt={child.first_name} className="w-10 h-10 rounded-full object-cover border border-border" />
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                            {child.first_name?.[0]}{child.last_name?.[0]}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium text-sm">{child.first_name} {child.last_name}</span>
                                          <span className="text-muted-foreground text-sm ml-2">Age {calcAge(child.date_of_birth)} • {format(new Date(child.date_of_birth), "d MMM yyyy")}</span>
                                          {child.gender && <span className="text-muted-foreground text-sm ml-1">• {child.gender}</span>}
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap items-center">
                                          {child.has_send && <Badge variant="outline" className="text-xs">SEND</Badge>}
                                          {(child.medical_conditions_list?.length > 0 || child.medical_info) && <Badge variant="outline" className="text-xs">Medical</Badge>}
                                          {(child.allergies_list?.length > 0 || child.allergies) && <Badge variant="destructive" className="text-xs">Allergies</Badge>}
                                          {child.has_inhaler && <Badge variant="outline" className="text-xs">Inhaler</Badge>}
                                          {child.has_epipen && <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">EpiPen</Badge>}
                                          {child.is_toilet_trained === false && <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">Toileting</Badge>}
                                          {child.ability_level && <Badge variant="secondary" className="text-xs capitalize">{child.ability_level}</Badge>}
                                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setEditingChild(child)}>
                                            <Pencil className="w-3 h-3" /> Edit
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Edit customer button */}
                              <div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingCustomer(customer)}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit customer details
                                </Button>
                              </div>

                              {/* Bookings summary */}
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <ShoppingBag className="h-3.5 w-3.5" /> Bookings ({custBookings.length})
                                  </h4>
                                  {custBookings.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No bookings yet</p>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {custBookings.filter((b: any) => b.status === "confirmed").length} confirmed
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {custBookings.filter((b: any) => b.status === "pending_payment").length} pending
                                      </Badge>
                                    </div>
                                  )}
                                </div>

                                {/* Authorized collectors */}
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Authorized Collectors ({custCollectors.length})
                                  </h4>
                                  {custCollectors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">None registered</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {custCollectors.map((c: any) => {
                                        const childName = children.find((ch: any) => ch.id === c.student_id);
                                        return (
                                          <p key={c.id} className="text-sm">
                                            {c.name} <span className="text-muted-foreground">({c.relationship}){childName ? ` — for ${childName.first_name}` : ""}</span>
                                          </p>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerEditDialog
        open={!!editingCustomer}
        onOpenChange={(o) => !o && setEditingCustomer(null)}
        profile={editingCustomer}
        onSaved={() => { setEditingCustomer(null); void refetchProfiles(); }}
      />

      <ChildFormDialog
        open={!!editingChild}
        onOpenChange={(o) => !o && setEditingChild(null)}
        editing={editingChild}
        onSaved={() => { setEditingChild(null); void refetchStudents(); }}
      />
    </div>
  );
};

export default AdminCustomers;
