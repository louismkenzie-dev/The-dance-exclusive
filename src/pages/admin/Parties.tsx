import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PartyPopper, Plus, Pencil, Trash2, GripVertical, Package, Gift, Image, Video, Youtube, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FadeRise, Stagger } from "@/components/motion";

type PartyPackage = {
  id: string;
  name: string;
  description: string | null;
  included_items: string[];
  price_1hr: number | null;
  price_1_5hr: number | null;
  max_guests: number;
  extra_guest_price: number;
  is_active: boolean;
  display_order: number;
  header_image: string | null;
  venue_id: string | null;
};

type VenueOption = {
  id: string;
  name: string;
  capacity: number | null;
};

type PartyExtra = {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
};

type PackageMedia = {
  id: string;
  package_id: string;
  media_type: string;
  file_path: string;
  caption: string | null;
  sort_order: number | null;
};

const emptyPackage = {
  name: "",
  description: "",
  included_items: [] as string[],
  price_1hr: "",
  price_1_5hr: "",
  max_guests: "18",
  extra_guest_price: "5",
  venue_id: "",
};

const NO_VENUE = "none";

const emptyExtra = {
  name: "",
  price: "",
  description: "",
};

const getPublicUrl = (path: string) => {
  const { data } = supabase.storage.from("party-media").getPublicUrl(path);
  return data.publicUrl;
};

const AdminParties = () => {
  const queryClient = useQueryClient();
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaPackageId, setMediaPackageId] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<PartyPackage | null>(null);
  const [editingExtra, setEditingExtra] = useState<PartyExtra | null>(null);
  const [packageForm, setPackageForm] = useState(emptyPackage);
  const [extraForm, setExtraForm] = useState(emptyExtra);
  const [newItem, setNewItem] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ["party-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_packages")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as PartyPackage[];
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["party-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as VenueOption[];
    },
  });

  const { data: extras = [], isLoading: extrasLoading } = useQuery({
    queryKey: ["party-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_extras")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as PartyExtra[];
    },
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ["party-package-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_package_media")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as PackageMedia[];
    },
  });

  const mediaForPackage = (pkgId: string) => allMedia.filter(m => m.package_id === pkgId);

  const savePackage = useMutation({
    mutationFn: async (form: typeof packageForm & { id?: string }) => {
      const payload = {
        name: form.name,
        description: form.description || null,
        included_items: form.included_items,
        price_1hr: form.price_1hr ? Number(form.price_1hr) : null,
        price_1_5hr: form.price_1_5hr ? Number(form.price_1_5hr) : null,
        max_guests: Number(form.max_guests),
        extra_guest_price: Number(form.extra_guest_price),
        venue_id: form.venue_id || null,
      };
      if (form.id) {
        const { error } = await supabase.from("party_packages").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("party_packages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-packages"] });
      setPackageDialogOpen(false);
      setEditingPackage(null);
      setPackageForm(emptyPackage);
      toast.success("Party package saved");
    },
    onError: () => toast.error("Failed to save package"),
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("party_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-packages"] });
      toast.success("Package deleted");
    },
  });

  const togglePackageActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("party_packages").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["party-packages"] }),
  });

  const saveExtra = useMutation({
    mutationFn: async (form: typeof extraForm & { id?: string }) => {
      const payload = {
        name: form.name,
        price: form.price ? Number(form.price) : null,
        description: form.description || null,
      };
      if (form.id) {
        const { error } = await supabase.from("party_extras").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("party_extras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-extras"] });
      setExtraDialogOpen(false);
      setEditingExtra(null);
      setExtraForm(emptyExtra);
      toast.success("Extra saved");
    },
    onError: () => toast.error("Failed to save extra"),
  });

  const deleteExtra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("party_extras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-extras"] });
      toast.success("Extra deleted");
    },
  });

  const toggleExtraActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("party_extras").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["party-extras"] }),
  });

  const deleteMedia = useMutation({
    mutationFn: async (media: PackageMedia) => {
      // Delete from storage if it's an uploaded file
      if (media.media_type !== "youtube") {
        await supabase.storage.from("party-media").remove([media.file_path]);
      }
      const { error } = await supabase.from("party_package_media").delete().eq("id", media.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-package-media"] });
      toast.success("Media removed");
    },
  });

  const openEditPackage = (pkg: PartyPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description || "",
      included_items: pkg.included_items,
      price_1hr: pkg.price_1hr?.toString() || "",
      price_1_5hr: pkg.price_1_5hr?.toString() || "",
      max_guests: pkg.max_guests.toString(),
      extra_guest_price: pkg.extra_guest_price.toString(),
      venue_id: pkg.venue_id || "",
    });
    setPackageDialogOpen(true);
  };

  const handleVenueChange = (value: string) => {
    const venueId = value === NO_VENUE ? "" : value;
    const venue = venues.find((v) => v.id === venueId);
    setPackageForm((f) => ({
      ...f,
      venue_id: venueId,
      // Auto-fill max guests from the venue capacity (still editable below)
      max_guests: venue?.capacity != null ? venue.capacity.toString() : f.max_guests,
    }));
  };

  const openEditExtra = (extra: PartyExtra) => {
    setEditingExtra(extra);
    setExtraForm({
      name: extra.name,
      price: extra.price?.toString() || "",
      description: extra.description || "",
    });
    setExtraDialogOpen(true);
  };

  const addIncludedItem = () => {
    if (newItem.trim()) {
      setPackageForm(prev => ({ ...prev, included_items: [...prev.included_items, newItem.trim()] }));
      setNewItem("");
    }
  };

  const removeIncludedItem = (index: number) => {
    setPackageForm(prev => ({
      ...prev,
      included_items: prev.included_items.filter((_, i) => i !== index),
    }));
  };

  const uploadHeaderImage = async (file: File, packageId: string) => {
    setUploadingHeader(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `headers/${packageId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("party-media").upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("party_packages").update({ header_image: path }).eq("id", packageId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["party-packages"] });
      toast.success("Header image uploaded");
    } catch {
      toast.error("Failed to upload header image");
    } finally {
      setUploadingHeader(false);
    }
  };

  const removeHeaderImage = async (pkg: PartyPackage) => {
    if (!pkg.header_image) return;
    await supabase.storage.from("party-media").remove([pkg.header_image]);
    await supabase.from("party_packages").update({ header_image: null }).eq("id", pkg.id);
    queryClient.invalidateQueries({ queryKey: ["party-packages"] });
    toast.success("Header image removed");
  };

  const uploadGalleryImages = async (files: FileList, packageId: string) => {
    setUploadingMedia(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `gallery/${packageId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("party-media").upload(path, file);
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("party_package_media").insert({
          package_id: packageId,
          media_type: "image",
          file_path: path,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["party-package-media"] });
      toast.success("Images uploaded");
    } catch {
      toast.error("Failed to upload images");
    } finally {
      setUploadingMedia(false);
    }
  };

  const uploadVideo = async (file: File, packageId: string) => {
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `videos/${packageId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("party-media").upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("party_package_media").insert({
        package_id: packageId,
        media_type: "video",
        file_path: path,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["party-package-media"] });
      toast.success("Video uploaded");
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploadingMedia(false);
    }
  };

  const addYoutubeLink = async (packageId: string) => {
    if (!youtubeUrl.trim()) return;
    const { error } = await supabase.from("party_package_media").insert({
      package_id: packageId,
      media_type: "youtube",
      file_path: youtubeUrl.trim(),
    });
    if (error) { toast.error("Failed to add YouTube link"); return; }
    queryClient.invalidateQueries({ queryKey: ["party-package-media"] });
    setYoutubeUrl("");
    toast.success("YouTube link added");
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const openMediaManager = (pkgId: string) => {
    setMediaPackageId(pkgId);
    setMediaDialogOpen(true);
    setYoutubeUrl("");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Birthday parties</h1>
              <p className="text-muted-foreground mt-1">
                Manage party packages, pricing and optional extras
              </p>
            </div>
          </div>
        </div>
      </FadeRise>

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages" className="gap-2">
            <Package className="h-4 w-4" /> Packages
          </TabsTrigger>
          <TabsTrigger value="extras" className="gap-2">
            <Gift className="h-4 w-4" /> Optional extras
          </TabsTrigger>
        </TabsList>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={packageDialogOpen} onOpenChange={(open) => {
              setPackageDialogOpen(open);
              if (!open) { setEditingPackage(null); setPackageForm(emptyPackage); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add package</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPackage ? "Edit party package" : "Add party package"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); savePackage.mutate({ ...packageForm, id: editingPackage?.id }); }} className="space-y-4">
                  <div>
                    <Label>Package name</Label>
                    <Input value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={packageForm.description} onChange={e => setPackageForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Select value={packageForm.venue_id || NO_VENUE} onValueChange={handleVenueChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a venue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_VENUE}>No specific venue</SelectItem>
                        {venues.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}{v.capacity != null ? ` (capacity ${v.capacity})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choosing a venue auto-fills max guests from its capacity — you can still override below.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Price (1 hour)</Label>
                      <Input type="number" step="0.01" value={packageForm.price_1hr} onChange={e => setPackageForm(f => ({ ...f, price_1hr: e.target.value }))} placeholder="£" />
                    </div>
                    <div>
                      <Label>Price (1.5 hours)</Label>
                      <Input type="number" step="0.01" value={packageForm.price_1_5hr} onChange={e => setPackageForm(f => ({ ...f, price_1_5hr: e.target.value }))} placeholder="£" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Max guests included</Label>
                      <Input type="number" value={packageForm.max_guests} onChange={e => setPackageForm(f => ({ ...f, max_guests: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Extra guest price (£)</Label>
                      <Input type="number" step="0.01" value={packageForm.extra_guest_price} onChange={e => setPackageForm(f => ({ ...f, extra_guest_price: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>What's included</Label>
                    <div className="space-y-2 mt-1">
                      {packageForm.included_items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1">{item}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeIncludedItem(i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add item..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addIncludedItem(); } }} />
                        <Button type="button" variant="outline" size="sm" onClick={addIncludedItem}>Add</Button>
                      </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={savePackage.isPending}>
                    {savePackage.isPending ? "Saving..." : "Save package"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {packagesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : packages.length === 0 ? (
            <FadeRise>
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Package className="h-6 w-6" />
                  </div>
                  <p className="text-muted-foreground">No packages yet. Add your first party package.</p>
                </CardContent>
              </Card>
            </FadeRise>
          ) : (
            <Stagger className="grid gap-4 md:grid-cols-2">
              {packages.map(pkg => {
                const media = mediaForPackage(pkg.id);
                const images = media.filter(m => m.media_type === "image");
                const videos = media.filter(m => m.media_type === "video");
                const youtubes = media.filter(m => m.media_type === "youtube");
                const totalMedia = images.length + videos.length + youtubes.length;

                return (
                  <Card key={pkg.id} className={`h-full overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${!pkg.is_active ? "opacity-60" : ""}`}>
                    {/* Header image */}
                    {pkg.header_image && (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={getPublicUrl(pkg.header_image)}
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg font-display">{pkg.name}</CardTitle>
                          {!pkg.is_active && <Badge variant="warning" className="mt-1">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={pkg.is_active} onCheckedChange={(checked) => togglePackageActive.mutate({ id: pkg.id, is_active: checked })} />
                          <Button variant="ghost" size="icon" onClick={() => openMediaManager(pkg.id)} title="Manage media">
                            <Image className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditPackage(pkg)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this package?")) deletePackage.mutate(pkg.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                      <CardDescription className="text-xs mt-1">{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-display font-bold tabular-nums text-primary">£{pkg.price_1hr}</p>
                          <p className="text-xs text-muted-foreground">1 hour</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-display font-bold tabular-nums text-primary">£{pkg.price_1_5hr}</p>
                          <p className="text-xs text-muted-foreground">1.5 hours</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">What's included:</p>
                        <ul className="text-sm space-y-0.5">
                          {pkg.included_items.map((item, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {totalMedia > 0 && (
                        <>
                          <Separator />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {images.length > 0 && <span className="flex items-center gap-1"><Image className="h-3 w-3" />{images.length} photo{images.length !== 1 ? "s" : ""}</span>}
                            {videos.length > 0 && <span className="flex items-center gap-1"><Video className="h-3 w-3" />{videos.length} video{videos.length !== 1 ? "s" : ""}</span>}
                            {youtubes.length > 0 && <span className="flex items-center gap-1"><Youtube className="h-3 w-3" />{youtubes.length} YouTube</span>}
                          </div>
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Up to {pkg.max_guests} guests • Extra guests: £{pkg.extra_guest_price}/child
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </Stagger>
          )}
        </TabsContent>

        {/* EXTRAS TAB */}
        <TabsContent value="extras" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={extraDialogOpen} onOpenChange={(open) => {
              setExtraDialogOpen(open);
              if (!open) { setEditingExtra(null); setExtraForm(emptyExtra); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add extra</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExtra ? "Edit optional extra" : "Add optional extra"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveExtra.mutate({ ...extraForm, id: editingExtra?.id }); }} className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={extraForm.name} onChange={e => setExtraForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Price (£) — leave blank if price on enquiry</Label>
                    <Input type="number" step="0.01" value={extraForm.price} onChange={e => setExtraForm(f => ({ ...f, price: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={extraForm.description} onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <Button type="submit" className="w-full" disabled={saveExtra.isPending}>
                    {saveExtra.isPending ? "Saving..." : "Save extra"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {extrasLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : extras.length === 0 ? (
            <FadeRise>
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Gift className="h-6 w-6" />
                  </div>
                  <p className="text-muted-foreground">No extras yet.</p>
                </CardContent>
              </Card>
            </FadeRise>
          ) : (
            <Stagger className="grid gap-3" step={60}>
              {extras.map(extra => (
                <Card key={extra.id} className={`transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${!extra.is_active ? "opacity-60" : ""}`}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{extra.name}</p>
                      {extra.description && <p className="text-xs text-muted-foreground">{extra.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {extra.price ? (
                        <Badge className="font-bold tabular-nums">£{extra.price}</Badge>
                      ) : (
                        <Badge variant="secondary">POA</Badge>
                      )}
                      <Switch checked={extra.is_active} onCheckedChange={(checked) => toggleExtraActive.mutate({ id: extra.id, is_active: checked })} />
                      <Button variant="ghost" size="icon" onClick={() => openEditExtra(extra)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this extra?")) deleteExtra.mutate(extra.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </Stagger>
          )}
        </TabsContent>
      </Tabs>

      {/* MEDIA MANAGER DIALOG */}
      <Dialog open={mediaDialogOpen} onOpenChange={(open) => { setMediaDialogOpen(open); if (!open) setMediaPackageId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Manage media — {packages.find(p => p.id === mediaPackageId)?.name}
            </DialogTitle>
          </DialogHeader>

          {mediaPackageId && (() => {
            const pkg = packages.find(p => p.id === mediaPackageId);
            if (!pkg) return null;
            const media = mediaForPackage(pkg.id);
            const images = media.filter(m => m.media_type === "image");
            const videos = media.filter(m => m.media_type === "video");
            const youtubes = media.filter(m => m.media_type === "youtube");

            return (
              <div className="space-y-6">
                {/* Header Image */}
                <div>
                  <Label className="text-sm font-semibold">Header image</Label>
                  <p className="text-xs text-muted-foreground mb-2">The main banner image for this package</p>
                  {pkg.header_image ? (
                    <div className="relative inline-block">
                      <img src={getPublicUrl(pkg.header_image)} alt="Header" className="h-32 rounded-xl object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeHeaderImage(pkg)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={headerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadHeaderImage(file, pkg.id);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => headerInputRef.current?.click()}
                        disabled={uploadingHeader}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {uploadingHeader ? "Uploading..." : "Upload header image"}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Gallery Images */}
                <div>
                  <Label className="text-sm font-semibold">Gallery images</Label>
                  <p className="text-xs text-muted-foreground mb-2">Additional photos for this package</p>
                  {images.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      {images.map(img => (
                        <div key={img.id} className="relative group">
                          <img src={getPublicUrl(img.file_path)} alt="" className="h-24 w-full rounded-xl object-cover" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteMedia.mutate(img)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) uploadGalleryImages(e.target.files, pkg.id);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploadingMedia}
                  >
                    <Image className="h-4 w-4 mr-1" />
                    {uploadingMedia ? "Uploading..." : "Add photos"}
                  </Button>
                </div>

                <Separator />

                {/* Videos */}
                <div>
                  <Label className="text-sm font-semibold">Video uploads</Label>
                  <p className="text-xs text-muted-foreground mb-2">Upload video files directly</p>
                  {videos.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {videos.map(vid => (
                        <div key={vid.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/60">
                          <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{vid.file_path.split("/").pop()}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMedia.mutate(vid)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadVideo(file, pkg.id);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploadingMedia}
                  >
                    <Video className="h-4 w-4 mr-1" />
                    {uploadingMedia ? "Uploading..." : "Upload video"}
                  </Button>
                </div>

                <Separator />

                {/* YouTube Links */}
                <div>
                  <Label className="text-sm font-semibold">YouTube links</Label>
                  <p className="text-xs text-muted-foreground mb-2">Add YouTube video links</p>
                  {youtubes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {youtubes.map(yt => {
                        const embedUrl = getYoutubeEmbedUrl(yt.file_path);
                        return (
                          <div key={yt.id} className="space-y-1">
                            {embedUrl && (
                              <div className="aspect-video rounded-xl overflow-hidden">
                                <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="YouTube video" />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Youtube className="h-4 w-4 text-destructive shrink-0" />
                              <span className="text-xs flex-1 truncate text-muted-foreground">{yt.file_path}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMedia.mutate(yt)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={youtubeUrl}
                      onChange={e => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addYoutubeLink(pkg.id)}
                      disabled={!youtubeUrl.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminParties;
