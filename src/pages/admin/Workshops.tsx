import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Image as ImageIcon, Video, Youtube, X, Instagram, Facebook, Music2, Globe, Link as LinkIcon, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FadeRise, Stagger } from "@/components/motion";

const DANCE_STYLES = ["Tap", "Modern", "Jazz", "Hip Hop", "Ballet", "Contemporary", "Lyrical", "Street", "Musical Theatre", "Acro", "Commercial", "Mixed"];

type PlatformInfo = { label: string; Icon: typeof Globe; className: string };

const detectPlatform = (url: string): PlatformInfo => {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { label: "Link", Icon: LinkIcon, className: "text-muted-foreground" };
  }
  if (host.includes("instagram.com")) return { label: "Instagram", Icon: Instagram, className: "text-accent" };
  if (host.includes("youtube.com") || host.includes("youtu.be")) return { label: "YouTube", Icon: Youtube, className: "text-destructive" };
  if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("fb.watch")) return { label: "Facebook", Icon: Facebook, className: "text-primary" };
  if (host.includes("tiktok.com")) return { label: "TikTok", Icon: Music2, className: "text-foreground" };
  return { label: "Website", Icon: Globe, className: "text-muted-foreground" };
};

const isValidUrl = (url: string) => /^https?:\/\//i.test(url.trim());

interface Workshop {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  dance_style: string | null;
  class_type: "children" | "adult";
  age_min: number | null;
  age_max: number | null;
  duration_minutes: number | null;
  price: number | null;
  links: string[] | null;
  cover_image: string | null;
  is_active: boolean;
  created_at: string;
}

interface WorkshopMedia {
  id: string;
  workshop_id: string;
  file_path: string;
  media_type: string;
  caption: string | null;
  sort_order: number;
}

const defaultForm = {
  name: "",
  description: "",
  dance_style: "",
  class_type: "children" as "children" | "adult",
  age_min: "",
  age_max: "",
  duration_minutes: "",
  links: [] as string[],
  is_active: true,
};

const AdminWorkshops = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [media, setMedia] = useState<WorkshopMedia[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "children" | "adult">("all");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchWorkshops = async () => {
    const { data } = await supabase.from("workshops").select("*").order("name", { ascending: true });
    if (data) setWorkshops(data as unknown as Workshop[]);
    setLoading(false);
  };

  const filteredWorkshops = typeFilter === "all"
    ? workshops
    : workshops.filter(w => w.class_type === typeFilter);

  useEffect(() => { fetchWorkshops(); }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setEditing(null);
    setCoverPreview(null);
    setCoverPath(null);
    setMedia([]);
  };

  const getMediaUrl = (path: string) => {
    const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const fetchMedia = async (workshopId: string) => {
    const { data } = await supabase.from("workshop_media").select("*").eq("workshop_id", workshopId).order("sort_order");
    if (data) setMedia(data as unknown as WorkshopMedia[]);
  };

  const openEdit = (w: Workshop) => {
    setEditing(w);
    setForm({
      name: w.name,
      description: w.description || "",
      dance_style: w.dance_style || "",
      class_type: w.class_type,
      age_min: w.age_min?.toString() || "",
      age_max: w.age_max?.toString() || "",
      duration_minutes: w.duration_minutes?.toString() || "",
      links: Array.isArray(w.links) ? w.links : [],
      is_active: w.is_active,
    });
    setCoverPath(w.cover_image);
    setCoverPreview(w.cover_image ? getMediaUrl(w.cover_image) : null);
    fetchMedia(w.id);
    setOpen(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCoverUploading(true);
    const ext = file.name.split(".").pop();
    const path = `covers/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("workshop-media").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      setCoverPath(path);
      setCoverPreview(getMediaUrl(path));
    }
    setCoverUploading(false);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editing) return;
    setMediaUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const path = `gallery/${editing.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("workshop-media").upload(path, file);
      if (uploadErr) {
        toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
        continue;
      }
      await supabase.from("workshop_media").insert({
        workshop_id: editing.id,
        file_path: path,
        media_type: mediaType,
        sort_order: media.length,
      });
    }
    await fetchMedia(editing.id);
    setMediaUploading(false);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const deleteMediaItem = async (item: WorkshopMedia) => {
    await supabase.storage.from("workshop-media").remove([item.file_path]);
    await supabase.from("workshop_media").delete().eq("id", item.id);
    setMedia(prev => prev.filter(m => m.id !== item.id));
  };

  const addLink = () => setForm((f) => ({ ...f, links: [...f.links, ""] }));
  const updateLink = (index: number, value: string) =>
    setForm((f) => ({ ...f, links: f.links.map((l, i) => (i === index ? value : l)) }));
  const removeLink = (index: number) =>
    setForm((f) => ({ ...f, links: f.links.filter((_, i) => i !== index) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedLinks = form.links.map((l) => l.trim()).filter((l) => l.length > 0);
    const invalidLink = cleanedLinks.find((l) => !isValidUrl(l));
    if (invalidLink) {
      toast({
        title: "Invalid link",
        description: `"${invalidLink}" is not a valid URL. Links must start with http:// or https://`,
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      name: form.name,
      description: form.description || null,
      dance_style: form.dance_style || null,
      class_type: form.class_type,
      age_min: form.age_min ? parseInt(form.age_min) : null,
      age_max: form.age_max ? parseInt(form.age_max) : null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      links: cleanedLinks,
      cover_image: coverPath,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("workshops").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("workshops").insert(payload));
    }

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: editing ? "Type of class updated" : "Type of class created" });
      setOpen(false);
      resetForm();
      fetchWorkshops();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("workshops").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Type of class removed" }); fetchWorkshops(); }
  };

  return (
    <div className="p-4 md:p-8">
      <FadeRise>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Type of class</h1>
          <p className="text-muted-foreground mt-1">Manage your class types — the templates classes are built from</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Add type of class</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader><DialogTitle>{editing ? "Edit type of class" : "New type of class"}</DialogTitle></DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto pr-4">
              <form id="workshop-form" onSubmit={handleSubmit} className="space-y-6 pb-4">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="media">Media</TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Type name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Street Dance KS1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Describe this type of class, what children/adults will learn..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Dance style</Label>
                      <Select value={form.dance_style} onValueChange={(v) => setForm({ ...form, dance_style: v })}>
                        <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                        <SelectContent>
                          {DANCE_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Audience</Label>
                      <Select value={form.class_type} onValueChange={(v: "children" | "adult") => setForm({ ...form, class_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="children">Children</SelectItem>
                          <SelectItem value="adult">Adult</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Min age</Label>
                        <Input type="number" min="0" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value })} placeholder="e.g. 4" />
                      </div>
                      <div className="space-y-2">
                        <Label>Max age</Label>
                        <Input type="number" min="0" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value })} placeholder="e.g. 12" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input type="number" min="1" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="e.g. 90" />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                      <div>
                        <Label className="text-sm font-medium">Active</Label>
                        <p className="text-xs text-muted-foreground">Visible to parents on the website</p>
                      </div>
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    </div>
                  </TabsContent>

                  {/* Media Tab */}
                  <TabsContent value="media" className="space-y-4 mt-4">
                    {/* Cover Image */}
                    <div className="space-y-2">
                      <Label>Cover image</Label>
                      <div
                        className="relative group cursor-pointer border-2 border-dashed border-border rounded-2xl aspect-square w-48 mx-auto flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverPreview ? (
                          <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-muted-foreground">
                            {coverUploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <ImageIcon className="w-8 h-8 mx-auto mb-1" />}
                            <p className="text-xs">Click to upload cover image</p>
                          </div>
                        )}
                        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                      </div>
                    </div>

                    {/* Links */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Links</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addLink}>
                          <Plus className="w-4 h-4 mr-2" /> Add link
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add any URLs — Instagram, Facebook, YouTube, TikTok, website, etc. Must start with http:// or https://
                      </p>
                      {form.links.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-2xl">
                          No links added yet. Click "Add link" to add one.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {form.links.map((link, i) => {
                            const trimmed = link.trim();
                            const { label, Icon, className } = detectPlatform(trimmed);
                            const showInvalid = trimmed.length > 0 && !isValidUrl(trimmed);
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className={`shrink-0 flex items-center gap-1.5 w-28 text-xs font-medium ${trimmed ? className : "text-muted-foreground"}`}>
                                    <Icon className="w-4 h-4" />
                                    <span className="truncate">{trimmed ? label : "Link"}</span>
                                  </div>
                                  <Input
                                    value={link}
                                    onChange={(e) => updateLink(i, e.target.value)}
                                    placeholder="https://..."
                                    className={showInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
                                  />
                                  {trimmed && isValidUrl(trimmed) && (
                                    <a
                                      href={trimmed}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                      title="Open link"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeLink(i)}
                                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove link"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                {showInvalid && (
                                  <p className="text-xs text-destructive pl-[7.5rem]">Must be a valid URL starting with http:// or https://</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Gallery - only for editing */}
                    {editing && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Gallery (images & videos)</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => mediaInputRef.current?.click()} disabled={mediaUploading}>
                            {mediaUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            Add media
                          </Button>
                          <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
                        </div>
                        {media.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-2xl">No media uploaded yet. Save this type of class first, then add gallery items.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {media.map((m) => (
                              <div key={m.id} className="relative group rounded-xl overflow-hidden bg-secondary aspect-square">
                                {m.media_type === "video" ? (
                                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                                    <Video className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <img src={getMediaUrl(m.file_path)} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteMediaItem(m)}
                                  className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!editing && (
                      <p className="text-xs text-muted-foreground">Save this type of class first, then you can add gallery images and videos.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </form>
            </div>
            <div className="flex shrink-0 gap-3 justify-end pt-4 pb-2 border-t border-border/50 bg-card/95 backdrop-blur">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" form="workshop-form">{editing ? "Update" : "Create type of class"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      </FadeRise>

      <FadeRise delay={80}>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "children" | "adult")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="children">Children</TabsTrigger>
              <TabsTrigger value="adult">Adult</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-muted-foreground">{filteredWorkshops.length} type{filteredWorkshops.length !== 1 ? "s" : ""}</span>
        </div>
      </FadeRise>

      {loading ? <div className="text-muted-foreground">Loading...</div> : filteredWorkshops.length === 0 ? (
        <FadeRise delay={140}>
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <ImageIcon className="h-6 w-6" />
              </div>
              <p className="text-muted-foreground">No class types found.</p>
            </CardContent>
          </Card>
        </FadeRise>
      ) : (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {filteredWorkshops.map((w) => {
             const isAdult = w.class_type === "adult";
             return (
            <Card key={w.id} className="h-full flex flex-col overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
              <div className="flex flex-1 gap-4 p-4">
                {w.cover_image ? (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-secondary">
                    <img src={getMediaUrl(w.cover_image)} alt={w.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`w-24 h-24 rounded-2xl shrink-0 flex items-center justify-center ${isAdult ? "bg-accent/8 text-accent" : "bg-primary/8 text-primary"}`}>
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <h3 className="font-display font-semibold text-lg leading-tight">{w.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <Badge variant={isAdult ? "accent" : "default"} className="capitalize">{w.class_type}</Badge>
                      {w.dance_style && <Badge variant="secondary">{w.dance_style}</Badge>}
                      {!w.is_active && <Badge variant="warning">Inactive</Badge>}
                    </div>
                  </div>
                  {w.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{w.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {(w.age_min !== null || w.age_max !== null) && (
                      <span>Ages {w.age_min ?? "?"} – {w.age_max ?? "?"}</span>
                    )}

                    {w.duration_minutes && <span>{w.duration_minutes} min</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 px-4 pb-3 border-t border-border/50 pt-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(w)}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
              </div>
            </Card>
          );
          })}
        </Stagger>
      )}
    </div>
  );
};

export default AdminWorkshops;
