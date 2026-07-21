import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Camera, User, Users, Star, ChevronDown, MapPin, Phone, Mail, Car, Briefcase, Heart, Upload, FileText, Shield, X, CheckCircle, Send, MailCheck, CalendarClock, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { YearsAtTdeBadge } from "@/components/staff/YearsAtTdeBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import { FadeRise, Stagger } from "@/components/motion";

type DocType = "paediatric_first_aid" | "other_first_aid" | "safeguarding" | "pli";

interface StaffDocument {
  id: string;
  staff_id: string;
  doc_type: string;
  file_path: string;
  label: string | null;
  expiry_date: string | null;
  created_at: string;
}

// Preset role values that show in the select. "other" reveals a free-text box.
const ROLE_PRESETS = [
  "ceo_owner",
  "instructor",
  "assistant_instructor",
  "assistant",
  "admin",
  "receptionist",
  "choreographer",
  "volunteer",
];

// Returns the status of an expiry date for highlighting.
const expiryStatus = (date: string | null): "expired" | "expiring" | "ok" | null => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(date);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring";
  return "ok";
};

const DANCE_STYLES = ["Tap", "Modern", "Jazz", "Hip Hop", "Ballet", "Contemporary", "Lyrical", "Street", "Musical Theatre", "Adult Fitness", "Acro", "Commercial"];

interface StaffMember {
  id: string;
  full_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  role: string;
  is_active: boolean;
  date_of_birth: string | null;
  start_date: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  secondary_nok_name: string | null;
  secondary_nok_phone: string | null;
  secondary_nok_relationship: string | null;
  description: string | null;
  drives: boolean;
  self_employed: boolean;
  pay_per_hour: number | null;
  dance_skills: string[];
  profile_photo: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  dbs_certificate_front: string | null;
  dbs_certificate_back: string | null;
  dbs_number: string | null;
  dbs_issue_date: string | null;
  dbs_update_service: boolean;
  dbs_expiry_date: string | null;
  pli_certificate: string | null;
  pli_cover_level: string | null;
  pli_expiry_date: string | null;
  user_id?: string | null;
  invited_at?: string | null;
  last_invite_sent_at?: string | null;
}

const defaultForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone: "",
  secondary_phone: "",
  role: "instructor",
  date_of_birth: "",
  start_date: "",
  next_of_kin_name: "",
  next_of_kin_phone: "",
  next_of_kin_relationship: "",
  secondary_nok_name: "",
  secondary_nok_phone: "",
  secondary_nok_relationship: "",
  description: "",
  drives: false,
  self_employed: false,
  pay_per_hour: "",
  dance_skills: [] as string[],
  profile_photo: "" as string,
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  postcode: "",
  dbs_certificate_front: "",
  dbs_certificate_back: "",
  dbs_number: "",
  dbs_issue_date: "",
  dbs_update_service: false,
  dbs_expiry_date: "",
  pli_certificate: "",
  pli_cover_level: "",
  pli_expiry_date: "",
};

const calculateAge = (dob: string) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const ROLE_LABELS: Record<string, string> = {
  ceo_owner: "CEO / owner",
  instructor: "Instructor",
  assistant_instructor: "Assistant instructor",
  assistant: "Assistant",
  admin: "Admin",
  receptionist: "Receptionist",
  choreographer: "Choreographer",
  volunteer: "Volunteer",
};

const formatRole = (role: string) => ROLE_LABELS[role] || role;

const AdminStaff = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [form, setForm] = useState(defaultForm);

  const [xpMap, setXpMap] = useState<Record<string, number>>({});

  // Role "Other (specify)" state
  const [roleIsOther, setRoleIsOther] = useState(false);

  // Profile photo crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Staff documents (paediatric_first_aid | other_first_aid | safeguarding | pli)
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [docUploadingType, setDocUploadingType] = useState<DocType | null>(null);

  const fetchStaff = async () => {
    const { data } = await supabase.from("staff").select("*").order("full_name");
    if (data) setStaff(data as unknown as StaffMember[]);
    setLoading(false);
  };

  const fetchXp = async () => {
    const today = new Date().toISOString().split("T")[0];
    // Count from session_instructors (explicit assignments)
    const { data: si } = await supabase
      .from("session_instructors")
      .select("staff_id, session:class_sessions!inner(session_date)")
      .lte("session.session_date", today);
    // Count from class_instructors via past sessions (default assignments)
    const { data: ci } = await supabase
      .from("class_instructors")
      .select("staff_id, class:classes!inner(id)");
    // Get past session counts per class for default instructors
    const { data: pastSessions } = await supabase
      .from("class_sessions")
      .select("id, class_id")
      .lte("session_date", today);

    const counts: Record<string, number> = {};
    // Count explicit session instructor assignments
    if (si) {
      for (const row of si) {
        counts[row.staff_id] = (counts[row.staff_id] || 0) + 1;
      }
    }
    // For class_instructors, count past sessions for their class minus any that have explicit overrides
    const sessionsWithOverride = new Set(si?.map((r: any) => r.session?.id).filter(Boolean) || []);
    if (ci && pastSessions) {
      const sessionsByClass: Record<string, string[]> = {};
      for (const s of pastSessions) {
        if (!sessionsByClass[s.class_id]) sessionsByClass[s.class_id] = [];
        sessionsByClass[s.class_id].push(s.id);
      }
      for (const row of ci) {
        const classId = (row.class as any)?.id;
        if (!classId || !sessionsByClass[classId]) continue;
        const unoverriddenCount = sessionsByClass[classId].filter(sid => !sessionsWithOverride.has(sid)).length;
        counts[row.staff_id] = (counts[row.staff_id] || 0) + unoverriddenCount;
      }
    }
    setXpMap(counts);
  };

  useEffect(() => { fetchStaff(); fetchXp(); }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setEditing(null);
    setPhotoPreview(null);
    setRoleIsOther(false);
    setDocuments([]);
    setShowCropper(false);
    setCropSrc(null);
  };

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  // --- Profile photo: open crop dialog on file select, upload cropped blob on save ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    // allow re-selecting the same file later
    e.target.value = "";
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!cropSrc || !croppedArea) return;
    setPhotoUploading(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedArea);
      const path = `${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from("staff-photos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      setForm(prev => ({ ...prev, profile_photo: path }));
      setPhotoPreview(getPhotoUrl(path));
      setShowCropper(false);
      setCropSrc(null);
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  // --- Staff documents ---
  const fetchDocuments = async (staffId: string) => {
    const { data } = await supabase
      .from("staff_documents")
      .select("*")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false });
    setDocuments((data as StaffDocument[]) || []);
  };

  const getDocUrl = (path: string) => {
    const { data } = supabase.storage.from("staff-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: DocType) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!editing) {
      toast({ title: "Save the staff member first", description: "Documents can be added once the staff record exists.", variant: "destructive" });
      return;
    }
    setDocUploadingType(docType);
    try {
      const ext = file.name.split(".").pop();
      const path = `${docType}/${editing.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("staff-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("staff_documents").insert({
        staff_id: editing.id,
        doc_type: docType,
        file_path: path,
        label: file.name,
      });
      if (insErr) throw insErr;
      await fetchDocuments(editing.id);
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setDocUploadingType(null);
    }
  };

  const updateDocExpiry = async (docId: string, expiry: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, expiry_date: expiry || null } : d));
    const { error } = await supabase.from("staff_documents").update({ expiry_date: expiry || null }).eq("id", docId);
    if (error) toast({ title: "Couldn't save expiry", description: error.message, variant: "destructive" });
  };

  const deleteDocument = async (doc: StaffDocument) => {
    const { error } = await supabase.from("staff_documents").delete().eq("id", doc.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.storage.from("staff-documents").remove([doc.file_path]);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast({ title: "Document removed" });
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setForm({
      first_name: s.first_name || "",
      middle_name: s.middle_name || "",
      last_name: s.last_name || "",
      email: s.email || "",
      phone: s.phone || "",
      secondary_phone: s.secondary_phone || "",
      role: s.role,
      date_of_birth: s.date_of_birth || "",
      start_date: s.start_date || "",
      next_of_kin_name: s.next_of_kin_name || "",
      next_of_kin_phone: s.next_of_kin_phone || "",
      next_of_kin_relationship: s.next_of_kin_relationship || "",
      secondary_nok_name: s.secondary_nok_name || "",
      secondary_nok_phone: s.secondary_nok_phone || "",
      secondary_nok_relationship: s.secondary_nok_relationship || "",
      description: s.description || "",
      drives: s.drives || false,
      self_employed: s.self_employed || false,
      pay_per_hour: s.pay_per_hour?.toString() || "",
      dance_skills: s.dance_skills || [],
      profile_photo: s.profile_photo || "",
      address_line1: s.address_line1 || "",
      address_line2: s.address_line2 || "",
      city: s.city || "",
      county: s.county || "",
      postcode: s.postcode || "",
      dbs_certificate_front: s.dbs_certificate_front || "",
      dbs_certificate_back: s.dbs_certificate_back || "",
      dbs_number: s.dbs_number || "",
      dbs_issue_date: s.dbs_issue_date || "",
      dbs_update_service: s.dbs_update_service || false,
      dbs_expiry_date: s.dbs_expiry_date || "",
      pli_certificate: s.pli_certificate || "",
      pli_cover_level: s.pli_cover_level || "",
      pli_expiry_date: s.pli_expiry_date || "",
    });
    setRoleIsOther(!ROLE_PRESETS.includes(s.role));
    setPhotoPreview(s.profile_photo ? getPhotoUrl(s.profile_photo) : null);
    setDocuments([]);
    fetchDocuments(s.id);
    setOpen(true);
  };

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      dance_skills: prev.dance_skills.includes(skill)
        ? prev.dance_skills.filter(s => s !== skill)
        : [...prev.dance_skills, skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ").trim();
    const payload: any = {
      full_name: fullName,
      first_name: form.first_name || null,
      middle_name: form.middle_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      secondary_phone: form.secondary_phone || null,
      role: form.role || "instructor",
      date_of_birth: form.date_of_birth || null,
      start_date: form.start_date || null,
      next_of_kin_name: form.next_of_kin_name || null,
      next_of_kin_phone: form.next_of_kin_phone || null,
      next_of_kin_relationship: form.next_of_kin_relationship || null,
      secondary_nok_name: form.secondary_nok_name || null,
      secondary_nok_phone: form.secondary_nok_phone || null,
      secondary_nok_relationship: form.secondary_nok_relationship || null,
      description: form.description || null,
      drives: form.drives,
      self_employed: form.self_employed,
      pay_per_hour: form.pay_per_hour ? parseFloat(form.pay_per_hour) : null,
      dance_skills: form.dance_skills,
      profile_photo: form.profile_photo || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      county: form.county || null,
      postcode: form.postcode || null,
      dbs_certificate_front: form.dbs_certificate_front || null,
      dbs_certificate_back: form.dbs_certificate_back || null,
      dbs_number: form.dbs_number || null,
      dbs_issue_date: form.dbs_issue_date || null,
      dbs_update_service: form.dbs_update_service,
      dbs_expiry_date: form.dbs_update_service ? null : (form.dbs_expiry_date || null),
      pli_certificate: form.pli_certificate || null,
      pli_cover_level: form.pli_cover_level || null,
      pli_expiry_date: form.pli_expiry_date || null,
    };

    let error;
    let createdStaffId: string | null = null;
    if (editing) {
      ({ error } = await supabase.from("staff").update(payload).eq("id", editing.id));
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("staff")
        .insert(payload)
        .select("id")
        .single();
      error = insertErr;
      createdStaffId = inserted?.id ?? null;
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Staff updated" : "Staff added" });
    setOpen(false);
    resetForm();
    fetchStaff();

    // Auto-send onboarding invite for newly created staff with an email
    if (!editing && createdStaffId && payload.email) {
      try {
        const { data: inviteData, error: inviteErr } = await supabase.functions.invoke("invite-staff", {
          body: { staffId: createdStaffId },
        });
        if (inviteErr) throw inviteErr;
        if (inviteData?.emailSent === false && inviteData?.inviteLink) {
          await navigator.clipboard.writeText(inviteData.inviteLink).catch(() => {});
          toast({
            title: "Account created — email not sent",
            description:
              "Email delivery isn't configured for this address yet. Invite link copied to clipboard so you can share it manually.",
          });
        } else {
          toast({
            title: "Onboarding email sent",
            description: `${payload.email} will receive a link to set their password.`,
          });
        }
        fetchStaff();
      } catch (e: any) {
        toast({
          title: "Couldn't send onboarding email",
          description: e.message || "You can resend it from the staff list.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Staff removed" }); fetchStaff(); }
  };

  const resendInvite = async (s: StaffMember) => {
    if (!s.email) {
      toast({ title: "No email", description: "Add an email address first.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", { body: { staffId: s.id } });
      if (error) throw error;
      if (data?.emailSent === false && data?.inviteLink) {
        await navigator.clipboard.writeText(data.inviteLink).catch(() => {});
        toast({
          title: "Email not sent — link copied",
          description: "Email delivery isn't configured for this address yet. Invite link copied to clipboard.",
        });
      } else {
        toast({ title: "Invite sent", description: `Onboarding link emailed to ${s.email}.` });
      }
      fetchStaff();
    } catch (e: any) {
      toast({ title: "Couldn't send invite", description: e.message, variant: "destructive" });
    }
  };

  const age = calculateAge(form.date_of_birth);

  // Renders an upload area + list for a given document type (multiple files, each with expiry).
  const renderDocSection = (docType: DocType, title: string, description?: string) => {
    const docs = documents.filter(d => d.doc_type === docType);
    return (
      <div className="rounded-2xl bg-secondary/40 p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <Label className="text-sm font-semibold">{title}</Label>
          </div>
          {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
        </div>

        {!editing ? (
          <p className="text-xs text-muted-foreground italic">Save the staff member first to upload documents.</p>
        ) : (
          <>
            {docs.length > 0 && (
              <div className="space-y-2">
                {docs.map((doc) => {
                  const st = expiryStatus(doc.expiry_date);
                  return (
                    <div
                      key={doc.id}
                      className={`rounded-xl p-2.5 space-y-2 text-xs ${st === "expired" ? "bg-destructive/10" : st === "expiring" ? "bg-warning/10" : "bg-card shadow-soft"}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <a href={getDocUrl(doc.file_path)} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline">
                          {doc.label || doc.file_path.split("/").pop()}
                        </a>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteDocument(doc)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground shrink-0">Expiry</Label>
                        <Input
                          type="date"
                          value={doc.expiry_date || ""}
                          onChange={(e) => updateDocExpiry(doc.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                        {st === "expired" && <Badge variant="destructive" className="shrink-0">Expired</Badge>}
                        {st === "expiring" && <Badge variant="warning" className="shrink-0">Soon</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors">
              {docUploadingType === docType ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">Upload file</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={docUploadingType === docType}
                onChange={(e) => handleDocUpload(e, docType)}
              />
            </label>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Staff</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage instructors and team</p>
            </div>
          </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4" /> Add staff</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader><DialogTitle>{editing ? "Edit staff member" : "New staff member"}</DialogTitle></DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto pr-4">
              <form id="staff-form" onSubmit={handleSubmit} className="space-y-6 pb-4">
                <Tabs defaultValue="personal" className="w-full">
                  <div className="overflow-x-auto -mx-1 px-1 pb-1">
                    <TabsList className="w-max">
                      <TabsTrigger value="personal">Personal</TabsTrigger>
                      <TabsTrigger value="address">Address</TabsTrigger>
                      <TabsTrigger value="next-of-kin">Next of kin</TabsTrigger>
                      <TabsTrigger value="work">Work</TabsTrigger>
                      <TabsTrigger value="documents">Documents</TabsTrigger>
                      <TabsTrigger value="safeguarding">Safeguarding</TabsTrigger>
                      <TabsTrigger value="skills">Skills</TabsTrigger>
                      <TabsTrigger value="bio">Bio</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Personal Tab */}
                  <TabsContent value="personal" className="space-y-4 mt-4">
                    {/* Profile Photo */}
                    {showCropper && cropSrc ? (
                      <div className="space-y-3">
                        <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden">
                          <Cropper
                            image={cropSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="text-xs text-muted-foreground">Zoom</Label>
                          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setShowCropper(false); setCropSrc(null); }} className="flex-1">Cancel</Button>
                          <Button type="button" size="sm" onClick={handleCropSave} disabled={photoUploading} className="flex-1">
                            {photoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save photo
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <Avatar className="w-32 h-32 shadow-soft-md">
                            <AvatarImage src={photoPreview || undefined} />
                            <AvatarFallback className="bg-secondary text-muted-foreground">
                              <User className="w-12 h-12" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            {photoUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Profile photo</p>
                          <p className="text-xs text-muted-foreground">Click to upload — you can reframe it before saving</p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First name *</Label>
                        <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Last name *</Label>
                        <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Middle name</Label>
                      <Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date of birth</Label>
                        <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Age</Label>
                        <Input value={age !== null ? `${age} years old` : ""} disabled />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Secondary phone</Label>
                      <Input value={form.secondary_phone} onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={roleIsOther ? "other" : form.role}
                        onValueChange={(v) => {
                          if (v === "other") {
                            setRoleIsOther(true);
                            setForm({ ...form, role: "" });
                          } else {
                            setRoleIsOther(false);
                            setForm({ ...form, role: v });
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ceo_owner">CEO / owner</SelectItem>
                          <SelectItem value="instructor">Instructor</SelectItem>
                          <SelectItem value="assistant_instructor">Assistant instructor</SelectItem>
                          <SelectItem value="assistant">Assistant</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="receptionist">Receptionist</SelectItem>
                          <SelectItem value="choreographer">Choreographer</SelectItem>
                          <SelectItem value="volunteer">Volunteer</SelectItem>
                          <SelectItem value="other">Other (specify)</SelectItem>
                        </SelectContent>
                      </Select>
                      {roleIsOther && (
                        <Input
                          className="mt-2"
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value })}
                          placeholder="Type the role title"
                        />
                      )}
                    </div>
                  </TabsContent>

                  {/* Address Tab */}
                  <TabsContent value="address" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Address line 1</Label>
                      <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="e.g. 10 High Street" />
                    </div>
                    <div className="space-y-2">
                      <Label>Address line 2</Label>
                      <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City / town</Label>
                        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>County</Label>
                        <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Postcode</Label>
                      <Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} placeholder="e.g. CM1 1AB" />
                    </div>
                  </TabsContent>

                  {/* Next of Kin Tab */}
                  <TabsContent value="next-of-kin" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Next of kin name *</Label>
                      <Input value={form.next_of_kin_name} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Next of kin phone *</Label>
                      <Input value={form.next_of_kin_phone} onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Select value={form.next_of_kin_relationship} onValueChange={(v) => setForm({ ...form, next_of_kin_relationship: v })}>
                        <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Secondary Next of Kin (optional) */}
                    <div className="rounded-2xl bg-secondary/40 p-4 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Heart className="w-4 h-4" />
                        </div>
                        <Label className="text-sm font-semibold">Secondary next of kin</Label>
                        <span className="text-xs text-muted-foreground">(optional)</span>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Name</Label>
                        <Input value={form.secondary_nok_name} onChange={(e) => setForm({ ...form, secondary_nok_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Phone</Label>
                        <Input value={form.secondary_nok_phone} onChange={(e) => setForm({ ...form, secondary_nok_phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Relationship</Label>
                        <Select value={form.secondary_nok_relationship} onValueChange={(v) => setForm({ ...form, secondary_nok_relationship: v })}>
                          <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="friend">Friend</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Work Tab */}
                  <TabsContent value="work" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/40 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Car className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Drives</Label>
                          <p className="text-xs text-muted-foreground">Can this staff member drive to venues?</p>
                        </div>
                      </div>
                      <Switch checked={form.drives} onCheckedChange={(v) => setForm({ ...form, drives: v })} />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/40 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Self-employed</Label>
                          <p className="text-xs text-muted-foreground">Paid via invoice rather than payroll</p>
                        </div>
                      </div>
                      <Switch checked={form.self_employed} onCheckedChange={(v) => setForm({ ...form, self_employed: v })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pay per hour (£)</Label>
                      <Input type="number" step="0.01" min="0" value={form.pay_per_hour} onChange={(e) => setForm({ ...form, pay_per_hour: e.target.value })} placeholder="e.g. 15.00" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-muted-foreground" /> Started with TDE</Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Admin-only — the date this person joined The Dance Exclusive.</p>
                    </div>

                    {/* DBS Update Service callout */}
                    <div className="rounded-2xl bg-primary/5 p-4 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Shield className="w-4 h-4" />
                        </div>
                        <Label className="text-sm font-semibold">DBS certificate</Label>
                      </div>
                      <label className="flex items-start gap-3 rounded-xl bg-card shadow-soft p-3 cursor-pointer">
                        <Checkbox
                          className="mt-0.5"
                          checked={form.dbs_update_service}
                          onCheckedChange={(c) => setForm({ ...form, dbs_update_service: !!c })}
                        />
                        <div>
                          <span className="text-sm font-medium">On the DBS Update Service?</span>
                          <p className="text-xs text-muted-foreground">If enrolled, the DBS is kept continuously up to date and has no fixed expiry.</p>
                        </div>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">DBS number</Label>
                          <Input value={form.dbs_number} onChange={(e) => setForm({ ...form, dbs_number: e.target.value })} placeholder="e.g. 001234567890" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Issue date</Label>
                          <Input type="date" value={form.dbs_issue_date} onChange={(e) => setForm({ ...form, dbs_issue_date: e.target.value })} />
                        </div>
                      </div>
                      {!form.dbs_update_service && (
                        <div className="space-y-2">
                          <Label className="text-xs">Expiry date</Label>
                          <Input type="date" value={form.dbs_expiry_date} onChange={(e) => setForm({ ...form, dbs_expiry_date: e.target.value })} />
                          {(() => {
                            const st = expiryStatus(form.dbs_expiry_date);
                            if (st === "expired") return <p className="text-xs text-destructive font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> DBS has expired</p>;
                            if (st === "expiring") return <p className="text-xs text-warning font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> DBS expires within 30 days</p>;
                            return null;
                          })()}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Front</Label>
                          {form.dbs_certificate_front ? (
                            <div className="flex items-center gap-2 rounded-xl bg-card shadow-soft p-2 text-xs">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate flex-1">{form.dbs_certificate_front.split("/").pop()}</span>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm({ ...form, dbs_certificate_front: "" })}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Upload front</span>
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const ext = file.name.split(".").pop();
                                const path = `dbs/${crypto.randomUUID()}-front.${ext}`;
                                const { error } = await supabase.storage.from("staff-documents").upload(path, file);
                                if (error) toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                                else setForm(prev => ({ ...prev, dbs_certificate_front: path }));
                              }} />
                            </label>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Back</Label>
                          {form.dbs_certificate_back ? (
                            <div className="flex items-center gap-2 rounded-xl bg-card shadow-soft p-2 text-xs">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="truncate flex-1">{form.dbs_certificate_back.split("/").pop()}</span>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm({ ...form, dbs_certificate_back: "" })}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Upload back</span>
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const ext = file.name.split(".").pop();
                                const path = `dbs/${crypto.randomUUID()}-back.${ext}`;
                                const { error } = await supabase.storage.from("staff-documents").upload(path, file);
                                if (error) toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                                else setForm(prev => ({ ...prev, dbs_certificate_back: path }));
                              }} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Public Liability Insurance Section */}
                    <div className="rounded-2xl bg-secondary/40 p-4 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                          <Shield className="w-4 h-4" />
                        </div>
                        <Label className="text-sm font-semibold">Public liability insurance</Label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Certificate (PDF or image)</Label>
                        {form.pli_certificate ? (
                          <div className="flex items-center gap-2 rounded-xl bg-card shadow-soft p-2 text-xs">
                            <FileText className="w-4 h-4 text-accent shrink-0" />
                            <span className="truncate flex-1">{form.pli_certificate.split("/").pop()}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm({ ...form, pli_certificate: "" })}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors">
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Upload certificate</span>
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const ext = file.name.split(".").pop();
                              const path = `pli/${crypto.randomUUID()}.${ext}`;
                              const { error } = await supabase.storage.from("staff-documents").upload(path, file);
                              if (error) toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                              else setForm(prev => ({ ...prev, pli_certificate: path }));
                            }} />
                          </label>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Cover level</Label>
                        <div className="flex gap-3">
                          {[
                            { value: "1m", label: "£1 million" },
                            { value: "5m", label: "£5 million" },
                            { value: "10m", label: "£10 million" },
                          ].map((level) => (
                            <label key={level.value} className={`flex items-center gap-2 rounded-xl p-3 cursor-pointer transition-colors flex-1 ${form.pli_cover_level === level.value ? "bg-accent/10 text-accent font-medium" : "bg-card shadow-soft hover:bg-secondary/60"}`}>
                              <Checkbox
                                checked={form.pli_cover_level === level.value}
                                onCheckedChange={(checked) => setForm({ ...form, pli_cover_level: checked ? level.value : "" })}
                              />
                              <span className="text-sm">{level.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">PLI expiry date</Label>
                        <Input type="date" value={form.pli_expiry_date} onChange={(e) => setForm({ ...form, pli_expiry_date: e.target.value })} />
                        {(() => {
                          const st = expiryStatus(form.pli_expiry_date);
                          if (st === "expired") return <p className="text-xs text-destructive font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> PLI has expired</p>;
                          if (st === "expiring") return <p className="text-xs text-warning font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> PLI expires within 30 days</p>;
                          return null;
                        })()}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Documents Tab */}
                  <TabsContent value="documents" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Heart className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-semibold">First aid</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Upload first aid certificates. Each file can have its own expiry date.</p>
                    </div>
                    {renderDocSection("paediatric_first_aid", "Paediatric first aid")}
                    {renderDocSection("other_first_aid", "Other first aid")}

                    <div className="pt-2">
                      {renderDocSection("pli", "Public liability insurance", "Upload PLI certificates with their expiry dates.")}
                    </div>
                  </TabsContent>

                  {/* Safeguarding Tab */}
                  <TabsContent value="safeguarding" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Shield className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-semibold">Safeguarding</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Upload safeguarding training certificates. Each file can have its own expiry date.</p>
                    </div>
                    {renderDocSection("safeguarding", "Safeguarding certificates")}
                  </TabsContent>

                  {/* Dance Skills Tab */}
                  <TabsContent value="skills" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">Select all dance styles this staff member can instruct:</p>
                    <div className="grid grid-cols-2 gap-3">
                      {DANCE_STYLES.map((style) => (
                        <label key={style} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3 cursor-pointer hover:bg-secondary/70 transition-colors">
                          <Checkbox
                            checked={form.dance_skills.includes(style)}
                            onCheckedChange={() => toggleSkill(style)}
                          />
                          <span className="text-sm">{style}</span>
                        </label>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Bio Tab */}
                  <TabsContent value="bio" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="A fun, engaging description about this staff member..."
                        rows={5}
                      />
                      <p className="text-xs text-muted-foreground">This will be visible to parents and students on the website.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
            </div>
            <div className="flex shrink-0 gap-3 justify-end pt-4 pb-2 border-t border-border/50 bg-card/95 backdrop-blur">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" form="staff-form">{editing ? "Update" : "Add staff member"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </FadeRise>

      {loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div> : staff.length === 0 ? (
        <FadeRise>
          <Card><CardContent className="py-12 text-center text-muted-foreground">No staff members yet.</CardContent></Card>
        </FadeRise>
      ) : (
        <Stagger className="space-y-4">
          {staff.map((s) => {
            const sAge = calculateAge(s.date_of_birth);
            const addressParts = [s.address_line1, s.address_line2, s.city, s.county, s.postcode].filter(Boolean);
            return (
            <Collapsible key={s.id}>
              <Card className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CollapsibleTrigger asChild>
                  <CardContent className="flex items-center justify-between py-4 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 shadow-soft">
                        <AvatarImage src={s.profile_photo ? getPhotoUrl(s.profile_photo) : undefined} />
                        <AvatarFallback className="bg-secondary text-muted-foreground">
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-semibold">{s.full_name}</h3>
                          <Badge variant="outline">{formatRole(s.role)}</Badge>
                          <YearsAtTdeBadge startDate={s.start_date} />
                          {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
                          {(xpMap[s.id] || 0) > 0 && (
                            <Badge variant="warning">
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              {xpMap[s.id]} XP
                            </Badge>
                          )}
                          {(() => {
                            if (!s.dbs_certificate_front) {
                              return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> DBS</Badge>;
                            }
                            const dbsStatus = s.dbs_update_service ? "ok" : expiryStatus(s.dbs_expiry_date);
                            if (dbsStatus === "expired") {
                              return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> DBS expired</Badge>;
                            }
                            if (dbsStatus === "expiring") {
                              return <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" /> DBS expiring</Badge>;
                            }
                            return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> DBS</Badge>;
                          })()}
                          {(() => {
                            if (!s.pli_certificate) {
                              return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> PLI</Badge>;
                            }
                            const pliStatus = expiryStatus(s.pli_expiry_date);
                            if (pliStatus === "expired") {
                              return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> PLI expired</Badge>;
                            }
                            if (pliStatus === "expiring") {
                              return <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" /> PLI expiring</Badge>;
                            }
                            return <Badge><CheckCircle className="w-3 h-3 mr-1" /> PLI</Badge>;
                          })()}
                          {s.user_id ? (
                            <Badge variant="success">
                              <MailCheck className="w-3 h-3 mr-1" /> Account
                            </Badge>
                          ) : s.invited_at ? (
                            <Badge variant="warning">
                              <Send className="w-3 h-3 mr-1" /> Invited
                            </Badge>
                          ) : (
                            <Badge variant="outline">No account</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[s.email, s.phone, sAge !== null ? `${sAge} years old` : null].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {s.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={s.user_id ? "Resend password set link" : "Send onboarding invite"}
                          onClick={(e) => { e.stopPropagation(); resendInvite(s); }}
                        >
                          <Send className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      <ChevronDown className="w-4 h-4 text-muted-foreground ml-2 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/60 px-6 py-5 space-y-4">
                    {/* Skills */}
                    {s.dance_skills?.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {s.dance_skills.map(skill => (
                          <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Contact */}
                      <div className="space-y-2">
                        <h4 className="eyebrow">Contact</h4>
                        {s.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{s.email}</span>
                          </div>
                        )}
                        {s.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {sAge !== null && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{sAge} years old{s.date_of_birth ? ` (${s.date_of_birth})` : ''}</span>
                          </div>
                        )}
                      </div>

                      {/* Location */}
                      <div className="space-y-2">
                        <h4 className="eyebrow">Location</h4>
                        {addressParts.length > 0 ? (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                            <span>{addressParts.join(', ')}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No address on file</p>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Car className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{s.drives ? 'Can drive to venues' : 'Does not drive'}</span>
                        </div>
                      </div>

                      {/* Work */}
                      <div className="space-y-2">
                        <h4 className="eyebrow">Work</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{s.self_employed ? 'Self-employed' : 'Payroll'}</span>
                        </div>
                        {s.pay_per_hour && (
                          <p className="text-sm">£{Number(s.pay_per_hour).toFixed(2)} / hour</p>
                        )}
                      </div>
                    </div>

                    {/* Next of Kin */}
                    {(s.next_of_kin_name || s.next_of_kin_phone) && (
                      <div className="space-y-2">
                        <h4 className="eyebrow">Next of kin</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>
                            {s.next_of_kin_name}
                            {s.next_of_kin_relationship ? ` (${s.next_of_kin_relationship})` : ''}
                            {s.next_of_kin_phone ? ` — ${s.next_of_kin_phone}` : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bio */}
                    {s.description && (
                      <div className="space-y-2">
                        <h4 className="eyebrow">Bio</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            );
          })}
        </Stagger>
      )}
    </div>
  );
};

export default AdminStaff;
