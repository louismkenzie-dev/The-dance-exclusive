import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, ChevronDown, ChevronRight, Mail, Phone, Baby, ExternalLink, MapPin, Calendar, ShoppingBag, ShieldCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FadeRise } from "@/components/motion";
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

const AdminCustomers = () => {
  const [search, setSearch] = useState("");
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
      const { data, error } = await supabase.from("bookings").select("id, parent_id, status");
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

  const filtered = (profiles || []).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
  });

  const calcAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const formatAddress = (p: Profile) => {
    return [p.address_line1, p.address_line2, p.city, p.county, p.postcode].filter(Boolean).join(", ");
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Customers</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Parent accounts and their registered children
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => window.open("/auth", "_blank")} className="gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Registration page
            </Button>
          </div>
        </div>
      </FadeRise>

      <FadeRise delay={60}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </FadeRise>

      <FadeRise delay={120}>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loadingProfiles ? (
              <div className="p-4 md:p-8 text-center text-muted-foreground animate-pulse">Loading customers...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 md:p-8 text-center text-muted-foreground">No customers found</div>
            ) : (
              <Table>
                <TableHeader className="[&_tr]:border-border/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-center">Children</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-center">Bookings</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:border-border/50">
                  {filtered.map((customer) => {
                    const children = studentsByParent[customer.user_id] || [];
                    const custBookings = bookingsByParent[customer.user_id] || [];
                    const custCollectors = collectorsByParent[customer.user_id] || [];
                    const isExpanded = expandedCustomer === customer.user_id;
                    const address = formatAddress(customer);
                    return (
                      <Fragment key={customer.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-secondary/40"
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
                            <Badge variant={children.length > 0 ? "default" : "outline"} className="min-w-[2rem] justify-center tabular-nums">
                              {children.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={custBookings.length > 0 ? "secondary" : "outline"} className="min-w-[2rem] justify-center tabular-nums">
                              {custBookings.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(customer.created_at), "dd MMM yyyy")}
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={6} className="py-5">
                              <div className="space-y-6">
                                {/* Contact & Address */}
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <h4 className="eyebrow">Contact details</h4>
                                    <div className="text-sm space-y-1">
                                      <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {customer.email}</p>
                                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.phone || "No phone"}</p>
                                      {customer.secondary_phone && (
                                        <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {customer.secondary_phone} <span className="text-xs text-muted-foreground">(secondary)</span></p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="eyebrow flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Address</h4>
                                    <p className="text-sm">{address || <span className="text-muted-foreground">No address on file</span>}</p>
                                    <h4 className="eyebrow flex items-center gap-1 mt-3"><Calendar className="h-3.5 w-3.5" /> Account</h4>
                                    <p className="text-sm">Joined {format(new Date(customer.created_at), "d MMMM yyyy")}</p>
                                  </div>
                                </div>

                                {/* Children */}
                                <div className="space-y-2">
                                  <h4 className="eyebrow flex items-center gap-1.5">
                                    <Baby className="h-3.5 w-3.5" /> Children ({children.length})
                                  </h4>
                                  {children.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No children registered</p>
                                  ) : (
                                    <div className="grid gap-2">
                                      {children.map((child: any) => (
                                        <div key={child.id} className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-soft">
                                          {child.profile_photo ? (
                                            <img src={child.profile_photo} alt={child.first_name} className="w-10 h-10 rounded-full object-cover" />
                                          ) : (
                                            <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center text-xs font-display font-bold text-primary">
                                              {child.first_name?.[0]}{child.last_name?.[0]}
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <span className="font-semibold text-sm">{child.first_name} {child.last_name}</span>
                                            <span className="text-muted-foreground text-sm ml-2">Age {calcAge(child.date_of_birth)} • {format(new Date(child.date_of_birth), "d MMM yyyy")}</span>
                                            {child.gender && <span className="text-muted-foreground text-sm ml-1">• {child.gender}</span>}
                                          </div>
                                          <div className="flex gap-1.5 flex-wrap items-center">
                                            {child.has_send && <Badge variant="warning" className="text-xs">SEND</Badge>}
                                            {(child.medical_conditions_list?.length > 0 || child.medical_info) && <Badge variant="outline" className="text-xs">Medical</Badge>}
                                            {(child.allergies_list?.length > 0 || child.allergies) && <Badge variant="destructive" className="text-xs">Allergies</Badge>}
                                            {child.has_inhaler && <Badge variant="outline" className="text-xs">Inhaler</Badge>}
                                            {child.has_epipen && <Badge variant="destructive" className="text-xs">EpiPen</Badge>}
                                            {child.is_toilet_trained === false && <Badge variant="warning" className="text-xs">Toileting</Badge>}
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
                                    <h4 className="eyebrow flex items-center gap-1.5">
                                      <ShoppingBag className="h-3.5 w-3.5" /> Bookings ({custBookings.length})
                                    </h4>
                                    {custBookings.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No bookings yet</p>
                                    ) : (
                                      <div className="flex gap-2">
                                        <Badge variant="success" className="text-xs">
                                          {custBookings.filter((b: any) => b.status === "confirmed").length} confirmed
                                        </Badge>
                                        <Badge variant="warning" className="text-xs">
                                          {custBookings.filter((b: any) => b.status === "pending_payment").length} pending
                                        </Badge>
                                      </div>
                                    )}
                                  </div>

                                  {/* Authorized collectors */}
                                  <div className="space-y-2">
                                    <h4 className="eyebrow flex items-center gap-1.5">
                                      <ShieldCheck className="h-3.5 w-3.5" /> Authorized collectors ({custCollectors.length})
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
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeRise>

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
