import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import VenueMap from "@/components/VenueMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Edit, Trash2, MapPin, Building2, Phone, Music, X, Camera, PoundSterling,
  CheckCircle, XCircle,
} from "lucide-react";
import { FadeRise } from "@/components/motion";
import { VenuePhotoGallery } from "@/components/VenuePhotoUpload";
import { slugify, VENUE_STATUSES } from "@/lib/venuePresentation";

interface Venue {
  id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  description: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  floor_type: string | null;
  has_mirrors: boolean;
  has_sound_system: boolean;
  has_changing_rooms: boolean;
  has_parking: boolean;
  parking_details: string | null;
  accessibility_info: string | null;
  latitude: number | null;
  longitude: number | null;
  map_embed_url: string | null;
  hire_cost_per_hour: number | null;
  hire_cost_notes: string | null;
  photo_outside: string | null;
  photo_indoor: string | null;
  photo_parking: string | null;
  has_waiting_area: boolean;
  access_code: string | null;
  contract_renewal_date: string | null;
  contract_notify_weeks: number | null;
  status: string;
  publicly_visible: boolean;
  is_featured: boolean;
  featured_order: number | null;
  slug: string | null;
  short_description: string | null;
}

interface Facility {
  id: string;
  venue_id: string;
  name: string;
}

interface VenueContact {
  id: string;
  venue_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

const emptyForm = {
  name: "", address_line1: "", address_line2: "", city: "", county: "Essex", postcode: "",
  capacity: "", notes: "", description: "", website_url: "",
  floor_type: "", has_mirrors: false, has_sound_system: false,
  has_changing_rooms: false, has_parking: false, parking_details: "", wifi_network: "", wifi_password: "",
  has_waiting_area: false, access_code: "",
  accessibility_info: "", latitude: "", longitude: "", map_embed_url: "",
  what3words: "", directions: "", drop_off_info: "",
  hire_cost_per_hour: "", hire_cost_per_day: "", hire_cost_notes: "", is_active: true,
  contract_renewal_date: "", contract_notify_weeks: "",
  status: "confirmed", publicly_visible: true, is_featured: false, featured_order: "",
  slug: "", short_description: "",
};

const AdminVenues = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [contacts, setContacts] = useState<VenueContact[]>([]);
  const [newFacility, setNewFacility] = useState("");
  const { toast } = useToast();

  const fetchVenues = async () => {
    const { data } = await supabase.from("venues").select("*").order("name");
    if (data) setVenues(data as any);
    setLoading(false);
  };

  const fetchFacilities = async (venueId: string) => {
    const { data } = await supabase.from("venue_facilities").select("*").eq("venue_id", venueId).order("name");
    if (data) setFacilities(data);
  };

  const fetchContacts = async (venueId: string) => {
    const { data } = await supabase.from("venue_contacts").select("*").eq("venue_id", venueId).order("name");
    if (data) setContacts(data as any);
  };

  useEffect(() => { fetchVenues(); }, []);

  const resetForm = () => { setForm({ ...emptyForm }); setEditing(null); setFacilities([]); setContacts([]); };

  const openEdit = (v: Venue) => {
    setEditing(v);
    setForm({
      name: v.name, address_line1: v.address_line1, address_line2: v.address_line2 || "",
      city: v.city, county: v.county || "", postcode: v.postcode, capacity: v.capacity?.toString() || "",
      notes: v.notes || "", description: v.description || "",
      website_url: v.website_url || "",
      floor_type: v.floor_type || "",
      has_mirrors: v.has_mirrors, has_sound_system: v.has_sound_system,
      has_changing_rooms: v.has_changing_rooms, has_parking: v.has_parking,
      parking_details: v.parking_details || "", wifi_network: (v as any).wifi_network || "", wifi_password: (v as any).wifi_password || "",
      has_waiting_area: v.has_waiting_area ?? false, access_code: v.access_code || "",
      accessibility_info: v.accessibility_info || "",
      latitude: v.latitude?.toString() || "", longitude: v.longitude?.toString() || "",
      map_embed_url: v.map_embed_url || "",
      what3words: (v as any).what3words || "", directions: (v as any).directions || "", drop_off_info: (v as any).drop_off_info || "",
      hire_cost_per_hour: v.hire_cost_per_hour?.toString() || "",
      hire_cost_per_day: (v as any).hire_cost_per_day?.toString() || "",
      hire_cost_notes: v.hire_cost_notes || "", is_active: v.is_active,
      contract_renewal_date: v.contract_renewal_date || "",
      contract_notify_weeks: v.contract_notify_weeks?.toString() || "",
      status: v.status || "confirmed",
      publicly_visible: v.publicly_visible ?? true,
      is_featured: v.is_featured ?? false,
      featured_order: v.featured_order?.toString() || "",
      slug: v.slug || "",
      short_description: v.short_description || "",
    });
    fetchFacilities(v.id);
    fetchContacts(v.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name, address_line1: form.address_line1,
      address_line2: form.address_line2 || null, city: form.city, county: form.county || null, postcode: form.postcode,
      capacity: form.capacity ? parseInt(form.capacity) : null, notes: form.notes || null,
      description: form.description || null,
      website_url: form.website_url || null,
      floor_type: form.floor_type || null,
      has_mirrors: form.has_mirrors, has_sound_system: form.has_sound_system,
      has_changing_rooms: form.has_changing_rooms, has_parking: form.has_parking,
      parking_details: form.parking_details || null, wifi_network: form.wifi_network || null, wifi_password: form.wifi_password || null,
      has_waiting_area: form.has_waiting_area, access_code: form.access_code || null,
      accessibility_info: form.accessibility_info || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      map_embed_url: form.map_embed_url || null,
      what3words: form.what3words || null, directions: form.directions || null, drop_off_info: form.drop_off_info || null,
      hire_cost_per_hour: form.hire_cost_per_hour ? parseFloat(form.hire_cost_per_hour) : null,
      hire_cost_per_day: form.hire_cost_per_day ? parseFloat(form.hire_cost_per_day) : null,
      hire_cost_notes: form.hire_cost_notes || null, is_active: form.is_active,
      contract_renewal_date: form.contract_renewal_date || null,
      contract_notify_weeks: form.contract_notify_weeks ? parseInt(form.contract_notify_weeks) : null,
      status: form.status,
      // Provisional venues default to hidden unless explicitly made public.
      publicly_visible: form.status === "provisional" && !editing ? false : form.publicly_visible,
      is_featured: form.is_featured,
      featured_order: form.featured_order !== "" ? parseInt(form.featured_order) : null,
      slug: (form.slug || slugify(form.name)) || null,
      short_description: form.short_description || null,
    };
    let error;
    if (editing) ({ error } = await supabase.from("venues").update(payload).eq("id", editing.id));
    else ({ error } = await supabase.from("venues").insert(payload));
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: editing ? "Venue updated" : "Venue created" }); setOpen(false); resetForm(); fetchVenues(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this venue permanently?")) return;
    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Venue deleted" }); fetchVenues(); }
  };

  const addFacility = async () => {
    if (!newFacility.trim() || !editing) return;
    const { error } = await supabase.from("venue_facilities").insert({ venue_id: editing.id, name: newFacility.trim() });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setNewFacility(""); fetchFacilities(editing.id); }
  };

  const removeFacility = async (id: string) => {
    if (!editing) return;
    await supabase.from("venue_facilities").delete().eq("id", id);
    fetchFacilities(editing.id);
  };

  const completenessScore = (v: Venue) => {
    const fields = [v.name, v.address_line1, v.postcode, v.description, v.phone, v.contact_name, v.capacity];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  };

  const FeatureIcon = ({ active }: { active: boolean }) =>
    active ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />;

  return (
    <div className="p-4 md:p-8">
      <FadeRise>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Venues</h1>
            <p className="text-muted-foreground mt-1">Manage your teaching locations with full details</p>
          </div>
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add venue
          </Button>
        </div>
      </FadeRise>

      {/* Venue map */}
      <FadeRise delay={80} className="mb-8">
        <VenueMap
          venues={venues}
          onVenueClick={(id) => {
            const venue = venues.find((v) => v.id === id);
            if (venue) openEdit(venue);
          }}
        />
      </FadeRise>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : venues.length === 0 ? (
        <FadeRise delay={140}>
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="text-muted-foreground">No venues yet. Add your first teaching location.</p>
            </CardContent>
          </Card>
        </FadeRise>
      ) : (
        <FadeRise delay={140}>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-muted-foreground">Venue</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Location</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-center">Capacity</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Features</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-center">Completeness</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/50 [&_tr]:border-0">
                  {venues.map((v) => {
                    const score = completenessScore(v);
                    return (
                      <TableRow key={v.id} className="cursor-pointer transition-colors hover:bg-secondary/40" onClick={() => openEdit(v)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {v.photo_outside ? (
                              <img src={v.photo_outside} alt={v.name} className="h-10 w-10 rounded-2xl object-cover shrink-0" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                                <Building2 className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold">{v.name}</p>
                              <p className="text-xs text-muted-foreground">{v.address_line1}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {v.city}{v.county ? `, ${v.county}` : ''}, {v.postcode}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {v.capacity ? <Badge variant="secondary" className="tabular-nums">{v.capacity}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <FeatureIcon active={v.has_mirrors} />
                            <FeatureIcon active={v.has_sound_system} />
                            <FeatureIcon active={v.has_parking} />
                            <FeatureIcon active={v.has_changing_rooms} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive"}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">{score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={v.is_active ? "success" : "secondary"}>
                              {v.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {v.status === "provisional" && (
                              <Badge variant="warning">Provisional</Badge>
                            )}
                            {!v.publicly_visible && (
                              <Badge variant="outline">Hidden</Badge>
                            )}
                            {v.is_featured && (
                              <Badge variant="default">
                                ★ {v.featured_order ?? "—"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </FadeRise>
      )}

      {/* Venue dialog with tabs */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit: ${editing.name}` : "New venue"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="details" className="mt-2">
              <TabsList className="flex h-auto w-full flex-wrap">
                <TabsTrigger value="details" className="flex-1 gap-1.5 px-3 text-xs"><Building2 className="w-3.5 h-3.5" /> Details</TabsTrigger>
                <TabsTrigger value="contact" className="flex-1 gap-1.5 px-3 text-xs"><Phone className="w-3.5 h-3.5" /> Contact</TabsTrigger>
                <TabsTrigger value="features" className="flex-1 gap-1.5 px-3 text-xs"><Music className="w-3.5 h-3.5" /> Features</TabsTrigger>
                <TabsTrigger value="media" className="flex-1 gap-1.5 px-3 text-xs"><Camera className="w-3.5 h-3.5" /> Media</TabsTrigger>
                <TabsTrigger value="location" className="flex-1 gap-1.5 px-3 text-xs"><MapPin className="w-3.5 h-3.5" /> Location</TabsTrigger>
                <TabsTrigger value="costs" className="flex-1 gap-1.5 px-3 text-xs"><PoundSterling className="w-3.5 h-3.5" /> Costs</TabsTrigger>
              </TabsList>

              {/* DETAILS TAB */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Venue name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Basildon Community Hall" />
                  </div>
                  <div className="space-y-2">
                    <Label>Capacity</Label>
                    <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Max dancers" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the venue, what makes it great for dance..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Address line 1 *</Label>
                  <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required placeholder="Street address" />
                </div>
                <div className="space-y-2">
                  <Label>Address line 2</Label>
                  <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>County</Label>
                    <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} placeholder="e.g., Essex" />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode *</Label>
                    <Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} required placeholder="e.g., SS14 1AA" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Internal notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Private notes about this venue (not visible to parents)" rows={2} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Venue is active</Label>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Publishing & featuring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Confirmation status</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) => setForm({
                            ...form,
                            status: v,
                            // Provisional venues default to hidden — an admin must explicitly re-enable.
                            publicly_visible: v === "provisional" ? false : form.publicly_visible,
                          })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VENUE_STATUSES.map(s => (
                              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>URL slug</Label>
                        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.name) || "auto-generated from name"} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Short description (public card text)</Label>
                      <Textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} placeholder="One or two sentences shown on the featured venue card" rows={2} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={form.publicly_visible} onCheckedChange={(v) => setForm({ ...form, publicly_visible: v })} />
                      <Label>Publicly visible on the booking site</Label>
                    </div>
                    {form.status === "provisional" && form.publicly_visible && (
                      <p className="text-xs text-warning">
                        This venue is provisional but set to publicly visible — it will appear on the public site.
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                      <Label>Feature in homepage carousel</Label>
                    </div>
                    {form.is_featured && (
                      <div className="space-y-2">
                        <Label>Featured order</Label>
                        <Input type="number" min="1" value={form.featured_order} onChange={(e) => setForm({ ...form, featured_order: e.target.value })} placeholder="1 = first" className="w-32" />
                        <p className="text-xs text-muted-foreground">
                          Lower numbers appear first. Venues without an order come last (alphabetically).
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CONTACT TAB */}
              <TabsContent value="contact" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Venue website</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://..." />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Contacts</CardTitle>
                    {editing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { data, error } = await supabase.from("venue_contacts").insert({ venue_id: editing.id, name: "", role: "", phone: "", email: "" } as any).select().single();
                          if (data) setContacts([...contacts, data as any]);
                          if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add contact
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!editing ? (
                      <p className="text-sm text-muted-foreground">Save the venue first, then you can add contacts.</p>
                    ) : contacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No contacts yet. Click "Add contact" to add one.</p>
                    ) : (
                      contacts.map((contact, idx) => (
                        <div key={contact.id} className="rounded-2xl bg-secondary/40 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="eyebrow">Contact {idx + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-6 w-6 p-0"
                              onClick={async () => {
                                await supabase.from("venue_contacts").delete().eq("id", contact.id);
                                setContacts(contacts.filter(c => c.id !== contact.id));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name *</Label>
                              <Input
                                value={contact.name}
                                onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, name: e.target.value } : c))}
                                onBlur={() => supabase.from("venue_contacts").update({ name: contact.name } as any).eq("id", contact.id)}
                                placeholder="e.g., Jane Smith"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Role</Label>
                              <Input
                                value={contact.role}
                                onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, role: e.target.value } : c))}
                                onBlur={() => supabase.from("venue_contacts").update({ role: contact.role } as any).eq("id", contact.id)}
                                placeholder="e.g., Site manager"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Phone</Label>
                              <Input
                                value={contact.phone}
                                onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, phone: e.target.value } : c))}
                                onBlur={() => supabase.from("venue_contacts").update({ phone: contact.phone } as any).eq("id", contact.id)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                value={contact.email}
                                onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, email: e.target.value } : c))}
                                onBlur={() => supabase.from("venue_contacts").update({ email: contact.email } as any).eq("id", contact.id)}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FEATURES TAB */}
              <TabsContent value="features" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Dance studio features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Floor type</Label>
                      <Input value={form.floor_type} onChange={(e) => setForm({ ...form, floor_type: e.target.value })} placeholder="e.g., Sprung wooden, vinyl, Marley" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Switch checked={form.has_mirrors} onCheckedChange={(v) => setForm({ ...form, has_mirrors: v })} />
                        <Label>Mirrors</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.has_sound_system} onCheckedChange={(v) => setForm({ ...form, has_sound_system: v })} />
                        <Label>Sound system</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.has_changing_rooms} onCheckedChange={(v) => setForm({ ...form, has_changing_rooms: v })} />
                        <Label>Changing rooms</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.has_parking} onCheckedChange={(v) => setForm({ ...form, has_parking: v })} />
                        <Label>Parking available</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={form.has_waiting_area} onCheckedChange={(v) => setForm({ ...form, has_waiting_area: v })} />
                        <Label>Waiting area</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Access code</Label>
                      <Input value={form.access_code} onChange={(e) => setForm({ ...form, access_code: e.target.value })} placeholder="e.g., Door code or key safe code" />
                      <p className="text-xs text-muted-foreground">
                        Visible to staff and admin only. Used for door entry / key safes at this venue.
                      </p>
                    </div>
                    {form.has_parking && (
                      <div className="space-y-2">
                        <Label>Parking details</Label>
                        <Textarea value={form.parking_details} onChange={(e) => setForm({ ...form, parking_details: e.target.value })} placeholder="e.g., Free on-site parking for 20 cars, street parking also available" rows={2} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Accessibility information</Label>
                      <Textarea value={form.accessibility_info} onChange={(e) => setForm({ ...form, accessibility_info: e.target.value })} placeholder="e.g., Step-free access, wheelchair accessible, lift to first floor" rows={2} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Wi-Fi</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Network name</Label>
                        <Input value={form.wifi_network} onChange={(e) => setForm({ ...form, wifi_network: e.target.value })} placeholder="e.g., VenueGuest" />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input value={form.wifi_password} onChange={(e) => setForm({ ...form, wifi_password: e.target.value })} placeholder="Wi-Fi password" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">This will be shared with staff members running classes at this venue.</p>
                  </CardContent>
                </Card>

                {editing && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Additional facilities</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Input value={newFacility} onChange={(e) => setNewFacility(e.target.value)} placeholder="e.g., Kitchen, WiFi, projector"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFacility(); } }} />
                        <Button type="button" size="sm" onClick={addFacility}><Plus className="w-4 h-4" /></Button>
                      </div>
                      {facilities.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {facilities.map((f) => (
                            <Badge key={f.id} variant="secondary" className="gap-1 pr-1">
                              {f.name}
                              <button type="button" onClick={() => removeFacility(f.id)} className="ml-1 hover:text-destructive">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {facilities.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No facilities added yet. Add items like WiFi, kitchen, projector, etc.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* MEDIA TAB */}
              <TabsContent value="media" className="space-y-6 mt-4">
                {editing ? (
                  <div className="grid gap-6 sm:grid-cols-3 items-start">
                    <VenuePhotoGallery
                      venueId={editing.id}
                      category="outside"
                      label="Outside photos"
                      description="Show the exterior of the venue so parents can find it easily"
                      legacyUrl={editing.photo_outside}
                    />
                    <VenuePhotoGallery
                      venueId={editing.id}
                      category="indoor"
                      label="Indoor / dance space"
                      description="Showcase the room where the dance class takes place"
                      legacyUrl={editing.photo_indoor}
                    />
                    <VenuePhotoGallery
                      venueId={editing.id}
                      category="parking"
                      label="Parking area"
                      description="Show parents where they can park when dropping off"
                      legacyUrl={editing.photo_parking}
                    />
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p>Save the venue first, then you can upload photos.</p>
                  </div>
                )}
              </TabsContent>

              {/* LOCATION TAB */}
              <TabsContent value="location" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>what3words location</Label>
                  <Input value={form.what3words} onChange={(e) => setForm({ ...form, what3words: e.target.value })} placeholder="e.g., ///filled.count.soap" />
                  <p className="text-xs text-muted-foreground">Find yours at <a href="https://what3words.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">what3words.com</a></p>
                </div>
                <div className="space-y-2">
                  <Label>Directions / how to find us</Label>
                  <Textarea value={form.directions} onChange={(e) => setForm({ ...form, directions: e.target.value })} placeholder="Describe how to get to the venue, e.g., Turn left after the church, entrance is through the blue gate on the right..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Parking information</Label>
                  <Textarea value={form.parking_details} onChange={(e) => setForm({ ...form, parking_details: e.target.value })} placeholder="Where to park, any restrictions, costs, nearest car park..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Drop-off information</Label>
                  <Textarea value={form.drop_off_info} onChange={(e) => setForm({ ...form, drop_off_info: e.target.value })} placeholder="Where parents can drop off children, e.g., Pull up by the main entrance on High Street..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Google Maps embed URL</Label>
                  <Input value={form.map_embed_url} onChange={(e) => setForm({ ...form, map_embed_url: e.target.value })} placeholder="Paste Google Maps embed URL" />
                </div>
                {form.map_embed_url && (
                  <div className="rounded-2xl overflow-hidden shadow-soft">
                    <iframe src={form.map_embed_url} className="w-full h-64" style={{ border: 0 }} allowFullScreen loading="lazy" />
                  </div>
                )}
              </TabsContent>

              {/* COSTS TAB */}
              <TabsContent value="costs" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hire cost (per hour)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                      <Input className="pl-7" type="number" step="0.01" value={form.hire_cost_per_hour} onChange={(e) => setForm({ ...form, hire_cost_per_hour: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Hire cost (per day)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                      <Input className="pl-7" type="number" step="0.01" value={form.hire_cost_per_day} onChange={(e) => setForm({ ...form, hire_cost_per_day: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cost notes</Label>
                  <Textarea value={form.hire_cost_notes} onChange={(e) => setForm({ ...form, hire_cost_notes: e.target.value })} placeholder="e.g., Discounted rate for block bookings, includes use of sound system" rows={3} />
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contract</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contract renewal date</Label>
                        <Input
                          type="date"
                          value={form.contract_renewal_date}
                          onChange={(e) => setForm({ ...form, contract_renewal_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notify me before expiry</Label>
                        <Select
                          value={form.contract_notify_weeks}
                          onValueChange={(v) => setForm({ ...form, contract_notify_weeks: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reminder" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 week before</SelectItem>
                            <SelectItem value="2">2 weeks before</SelectItem>
                            <SelectItem value="3">3 weeks before</SelectItem>
                            <SelectItem value="4">1 month before</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit">{editing ? "Update venue" : "Create venue"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVenues;
