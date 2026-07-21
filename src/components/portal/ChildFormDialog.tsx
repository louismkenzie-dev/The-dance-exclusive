import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  Camera,
  Droplets,
  Heart,
  HeartPulse,
  Loader2,
  Puzzle,
  Save,
  ShieldAlert,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import tdeLogo from "@/assets/logo-avatar-512.png";

const GENDER_OPTIONS = ["Female", "Male", "Non-Binary", "Prefer Not to Say"];

const MEDICAL_CONDITIONS = [
  "Asthma", "Hay Fever", "Eczema", "Epilepsy", "Diabetes (Type 1)", "Diabetes (Type 2)",
  "Migraine", "Heart Condition", "Sickle Cell", "Coeliac Disease", "Cystic Fibrosis",
];

const COMMON_ALLERGIES = [
  "Nut Allergy (Peanuts)", "Nut Allergy (Tree Nuts)", "Dairy / Lactose", "Egg Allergy",
  "Gluten / Wheat", "Soya", "Fish / Shellfish", "Sesame", "Hay Fever (Pollen)",
  "Insect Stings (Bee/Wasp)", "Penicillin", "Latex", "Animal Fur / Dander",
];

const SEND_CONDITIONS = [
  "ADHD", "Autism Spectrum (ASD)", "Anxiety", "Dyslexia", "Dyspraxia / DCD",
  "Dyscalculia", "Speech & Language Difficulties", "Hearing Impairment",
  "Visual Impairment", "Down Syndrome", "Cerebral Palsy",
  "Global Developmental Delay", "Selective Mutism", "ODD (Oppositional Defiant Disorder)",
  "Sensory Processing Disorder", "Tourette's / Tic Disorder",
  "Social, Emotional & Mental Health (SEMH)", "Physical Disability",
];

const ABILITY_LEVELS = [
  { value: "newcomer", label: "Newcomer — Never danced before" },
  { value: "learning", label: "Learning — Just started" },
  { value: "progressive", label: "Progressive — Building skills" },
  { value: "experienced", label: "Experienced — Confident dancer" },
];

/** Quiet pill checklist item — a soft rounded chip that lights up when ticked. */
const PillCheck = ({
  id,
  label,
  checked,
  onToggle,
}: {
  id?: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) => (
  <label
    htmlFor={id}
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors duration-200",
      checked
        ? "bg-primary/10 font-medium text-primary"
        : "bg-secondary/60 text-foreground hover:bg-secondary",
    )}
  >
    <Checkbox id={id} checked={checked} onCheckedChange={onToggle} className="shrink-0" />
    <span className="leading-tight">{label}</span>
  </label>
);

/** Icon tile + label heading used inside each accordion section trigger. */
const SectionHeading = ({
  icon: Icon,
  tile,
  children,
}: {
  icon: typeof User;
  tile: string;
  children: React.ReactNode;
}) => (
  <span className="flex items-center gap-3 text-left">
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tile)}>
      <Icon className="h-4 w-4" />
    </span>
    <span>{children}</span>
  </span>
);

interface ChildFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: any;
  /**
   * Adult attendee profile mode: the account holder fills this in about
   * THEMSELVES so registers and QR check-in have their age and medical info.
   * Hides the child-specific sections and saves with is_self = true.
   */
  selfMode?: boolean;
}

export const ChildFormDialog = ({ open, onOpenChange, onSaved, editing, selfMode = false }: ChildFormDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Photo crop state
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

  // Dance Exclusive Avatar Studio
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const handleGenerateAvatar = async () => {
    if (!editing?.id) return;
    setAvatarLoading(true);
    try {
      // The avatar is generated from the SAVED profile photo — persist the
      // currently selected photo first so the studio uses what's on screen.
      if (uploadedPhotoUrl && uploadedPhotoUrl !== editing.profile_photo) {
        await supabase.from("students").update({ profile_photo: uploadedPhotoUrl }).eq("id", editing.id);
      }
      // Ship the official TDE logo along so the generated t-shirt carries the
      // real brand mark rather than an invented one.
      const logoDataUrl = await fetch(tdeLogo)
        .then((r) => r.blob())
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result as string);
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            }),
        )
        .catch(() => null);
      const { data, error } = await supabase.functions.invoke("generate-avatar", {
        body: { studentId: editing.id, logoDataUrl },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep original */ }
      }
      if (error || !data?.avatarUrl) {
        toast({ title: "Avatar Studio", description: message || "Couldn't create the avatar — please try again.", variant: "destructive" });
      } else {
        setAvatarUrl(data.avatarUrl);
        toast({ title: "✨ Avatar created!", description: "Saved! It now appears right next to the real photo." });
      }
    } catch (e: any) {
      toast({ title: "Avatar Studio", description: e?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const [form, setForm] = useState<any>({
    first_name: "", last_name: "", preferred_name: "", date_of_birth: "", gender: "",
    medical_info: "", allergies: "", emergency_contact_name: "", emergency_contact_phone: "",
    medical_conditions_list: [] as string[],
    has_inhaler: false, has_epipen: false,
    allergies_list: [] as string[],
    has_send: false, send_conditions_list: [] as string[], send_details: "",
    send_triggers_coping: {} as Record<string, { triggers: string; coping_techniques: string }>,
    ehcp_in_place: false, one_to_one_required: false,
    is_toilet_trained: true, toileting_notes: "", wears_nappies: false, prone_to_accidents: false,
    dance_style_preference: "", ability_level: "", has_stage_experience: false,
    child_hook: "", photo_consent: true, social_media_consent: false,
    has_medical_conditions: false, has_allergies: false,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        first_name: editing.first_name || "",
        last_name: editing.last_name || "",
        preferred_name: editing.preferred_name || "",
        date_of_birth: editing.date_of_birth || "",
        gender: editing.gender || "",
        medical_info: editing.medical_info || "",
        allergies: editing.allergies || "",
        emergency_contact_name: editing.emergency_contact_name || "",
        emergency_contact_phone: editing.emergency_contact_phone || "",
        medical_conditions_list: editing.medical_conditions_list || [],
        has_inhaler: editing.has_inhaler || false,
        has_epipen: editing.has_epipen || false,
        allergies_list: editing.allergies_list || [],
        has_send: editing.has_send || false,
        send_conditions_list: editing.send_conditions_list || [],
        send_details: editing.send_details || "",
        send_triggers_coping: editing.send_triggers_coping || {},
        ehcp_in_place: editing.ehcp_in_place || false,
        one_to_one_required: editing.one_to_one_required || false,
        is_toilet_trained: editing.is_toilet_trained ?? true,
        toileting_notes: editing.toileting_notes || "",
        wears_nappies: editing.wears_nappies || false,
        prone_to_accidents: editing.prone_to_accidents || false,
        dance_style_preference: editing.dance_style_preference || "",
        ability_level: editing.ability_level || "",
        has_stage_experience: editing.has_stage_experience || false,
        child_hook: editing.child_hook || "",
        photo_consent: editing.photo_consent ?? true,
        social_media_consent: editing.social_media_consent || false,
        has_medical_conditions: (editing.medical_conditions_list?.length > 0 || editing.has_inhaler || editing.has_epipen || editing.medical_info),
        has_allergies: (editing.allergies_list?.length > 0 || editing.allergies),
      });
      setUploadedPhotoUrl(editing.profile_photo || null);
      setAvatarUrl(editing.avatar_url || null);
    } else {
      setForm({
        first_name: "", last_name: "", preferred_name: "", date_of_birth: "", gender: "",
        medical_info: "", allergies: "", emergency_contact_name: "", emergency_contact_phone: "",
        medical_conditions_list: [], has_inhaler: false, has_epipen: false,
        allergies_list: [], has_send: false, send_conditions_list: [], send_details: "",
        send_triggers_coping: {}, ehcp_in_place: false, one_to_one_required: false,
        is_toilet_trained: true, toileting_notes: "", wears_nappies: false, prone_to_accidents: false,
        dance_style_preference: "", ability_level: "", has_stage_experience: false,
        child_hook: "", photo_consent: true, social_media_consent: false,
        has_medical_conditions: false, has_allergies: false,
      });
      setUploadedPhotoUrl(null);
      setAvatarUrl(null);
      setPhotoSrc(null);
      setShowCropper(false);
    }
  }, [editing, open]);

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const toggleListItem = (key: string, item: string) => {
    const list = form[key] as string[];
    if (list.includes(item)) update(key, list.filter((i: string) => i !== item));
    else update(key, [...list, item]);
  };

  const toggleSendCondition = (condition: string) => {
    const list = form.send_conditions_list as string[];
    if (list.includes(condition)) {
      update("send_conditions_list", list.filter((i: string) => i !== condition));
      const tc = { ...form.send_triggers_coping };
      delete tc[condition];
      update("send_triggers_coping", tc);
    } else {
      update("send_conditions_list", [...list, condition]);
    }
  };

  const updateSendDetail = (condition: string, field: string, value: string) => {
    const tc = { ...form.send_triggers_coping };
    tc[condition] = { ...(tc[condition] || { triggers: "", coping_techniques: "" }), [field]: value };
    update("send_triggers_coping", tc);
  };

  const getAge = (dob: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoSrc(reader.result as string);
      setShowCropper(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleCropSave = async () => {
    if (!photoSrc || !croppedArea || !user) return;
    try {
      const blob = await getCroppedImg(photoSrc, croppedArea);
      const path = `${user.id}/student-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from("student-photos").upload(path, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("student-photos").getPublicUrl(path);
      setUploadedPhotoUrl(publicUrl);
      setShowCropper(false);
      toast({ title: "Photo saved!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      parent_id: user.id,
      first_name: form.first_name,
      last_name: form.last_name,
      preferred_name: form.preferred_name || null,
      date_of_birth: form.date_of_birth,
      gender: form.gender || null,
      medical_info: form.medical_info || null,
      allergies: form.allergies || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      profile_photo: uploadedPhotoUrl || null,
      medical_conditions_list: form.medical_conditions_list,
      has_inhaler: form.has_inhaler,
      has_epipen: form.has_epipen,
      allergies_list: form.allergies_list,
      has_send: form.has_send,
      send_conditions_list: form.send_conditions_list,
      send_details: form.send_details || null,
      send_triggers_coping: form.send_triggers_coping,
      ehcp_in_place: form.ehcp_in_place,
      one_to_one_required: form.one_to_one_required,
      is_toilet_trained: form.is_toilet_trained,
      toileting_notes: form.toileting_notes || null,
      wears_nappies: form.wears_nappies,
      prone_to_accidents: form.prone_to_accidents,
      dance_style_preference: form.dance_style_preference || null,
      ability_level: form.ability_level || null,
      has_stage_experience: form.has_stage_experience,
      child_hook: form.child_hook || null,
      photo_consent: form.photo_consent,
      social_media_consent: form.social_media_consent,
      is_self: selfMode,
    };

    let error;
    if (editing) {
      const { parent_id, ...updatePayload } = payload;
      ({ error } = await supabase.from("students").update(updatePayload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("students").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Child updated!" : "Child added!" });
      onOpenChange(false);
      onSaved();
    }
  };

  const age = getAge(form.date_of_birth);
  const medicalConditions = form.medical_conditions_list as string[];
  const allergiesList = form.allergies_list as string[];
  const sendConditions = form.send_conditions_list as string[];
  const sendTriggersCoping = form.send_triggers_coping as Record<string, { triggers: string; coping_techniques: string }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            {selfMode
              ? (editing ? "Edit your attendee profile" : "Create your attendee profile")
              : (editing ? "Edit child" : "Add child")}
          </DialogTitle>
          {selfMode && (
            <p className="text-sm text-muted-foreground">
              Booking a class for yourself? We need your details for the class register —
              age, medical information and when you expect to arrive and leave.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-5 pb-6">
            {/* ═══ PROFILE PHOTO ═══ */}
            <div className="flex flex-col items-center gap-3">
              {showCropper && photoSrc ? (
                <div className="w-full space-y-3">
                  <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden">
                    <Cropper
                      image={photoSrc}
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
                    <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-primary" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCropper(false)} className="flex-1">Cancel</Button>
                    <Button size="sm" onClick={handleCropSave} className="flex-1">Save photo</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative w-28 h-28 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden group cursor-pointer transition-colors hover:border-primary/40"
                    onClick={() => document.getElementById("photo-input")?.click()}>
                    {uploadedPhotoUrl ? (
                      <img src={uploadedPhotoUrl} alt="Child" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  <p className="text-xs text-muted-foreground">Click to upload a photo</p>

                  {/* ═══ DANCE EXCLUSIVE AVATAR STUDIO ═══ */}
                  {uploadedPhotoUrl && editing && (
                    <div className="w-full max-w-sm space-y-3">
                      {!avatarUrl && (
                        <>
                          <Button
                            type="button"
                            onClick={handleGenerateAvatar}
                            disabled={avatarLoading}
                            className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 shadow-soft"
                          >
                            {avatarLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Creating your avatar… (~1 min)
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-4 h-4" /> Create Dance Exclusive avatar
                              </>
                            )}
                          </Button>
                          {!avatarLoading && (
                            <p className="text-[11px] text-muted-foreground text-center">
                              {selfMode
                                ? "Turn this photo into an on-brand studio portrait — you in Dance Exclusive merch under the signature pink lights. ✨"
                                : "Turn this photo into an on-brand cartoon — your child in Dance Exclusive merch, dancing on stage under the lights. ✨"}
                            </p>
                          )}
                        </>
                      )}
                      {avatarUrl && (
                        <div className="flex flex-col items-center gap-3 rounded-2xl bg-primary/5 p-4">
                          <PhotoAvatarDuo photoUrl={uploadedPhotoUrl} avatarUrl={avatarUrl} size="lg" showLabels />
                          <p className="text-[11px] text-muted-foreground text-center">
                            Both are saved — parents and staff always see the real photo and the avatar together.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {uploadedPhotoUrl && !editing && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      ✨ Save the profile first to unlock the Dance Exclusive Avatar Studio.
                    </p>
                  )}
                </>
              )}
            </div>

            <Accordion type="multiple" defaultValue={["basic", "medical", "allergies", "send", "toileting", "dance", "consent"]} className="space-y-3">
              {/* ═══ BASIC DETAILS ═══ */}
              <AccordionItem value="basic" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={User} tile="bg-primary/10 text-primary">Basic details</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>First name *</Label><Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Last name *</Label><Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred name / nickname</Label>
                    <Input value={form.preferred_name} onChange={(e) => update("preferred_name", e.target.value)} placeholder="What do they like to be called?" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of birth *</Label>
                      <Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} required />
                      {age !== null && (
                        <p className="text-sm font-medium text-primary">Age: {age} years old</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Emergency contact name</Label><Input value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Emergency contact phone</Label><Input value={form.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ═══ MEDICAL ═══ */}
              <AccordionItem value="medical" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={HeartPulse} tile="bg-warning/10 text-warning">Medical information</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm">{selfMode ? "Do you have any medical conditions?" : "Does your child have any medical conditions?"}</Label>
                    <Switch checked={form.has_medical_conditions} onCheckedChange={(c) => update("has_medical_conditions", c)} />
                  </div>

                  {form.has_medical_conditions && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Known medical conditions</Label>
                        <p className="text-xs text-muted-foreground">Tick any that apply</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {MEDICAL_CONDITIONS.map((condition) => (
                            <PillCheck
                              key={condition}
                              id={`cond-${condition}`}
                              label={condition}
                              checked={medicalConditions.includes(condition)}
                              onToggle={() => toggleListItem("medical_conditions_list", condition)}
                            />
                          ))}
                        </div>
                      </div>

                      {medicalConditions.includes("Asthma") && (
                        <Alert className="rounded-2xl border-0 bg-warning/10">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-sm">
                            <strong>Inhaler required:</strong> Please ensure your child brings a named inhaler to class.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox id="has-inhaler" checked={form.has_inhaler} onCheckedChange={(c) => update("has_inhaler", !!c)} />
                          <Label htmlFor="has-inhaler" className="text-sm cursor-pointer font-normal">{selfMode ? "I carry an inhaler" : "Child carries an inhaler"}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="has-epipen" checked={form.has_epipen} onCheckedChange={(c) => update("has_epipen", !!c)} />
                          <Label htmlFor="has-epipen" className="text-sm cursor-pointer font-normal">{selfMode ? "I carry an EpiPen" : "Child carries an EpiPen"}</Label>
                        </div>
                        {form.has_epipen && (
                          <Alert className="rounded-2xl border-0 bg-destructive/10">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <AlertDescription className="text-sm">
                              <strong>Important:</strong> Please ensure the named EpiPen is brought to every class. Our staff include trained first aiders.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Other medical information</Label>
                        <Textarea placeholder="Any other conditions not listed above..." value={form.medical_info || ""} onChange={(e) => update("medical_info", e.target.value)} rows={2} />
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ═══ ALLERGIES ═══ */}
              <AccordionItem value="allergies" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={ShieldAlert} tile="bg-destructive/10 text-destructive">Allergies</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm">{selfMode ? "Do you have any allergies?" : "Does your child have any allergies?"}</Label>
                    <Switch checked={form.has_allergies} onCheckedChange={(c) => update("has_allergies", c)} />
                  </div>

                  {form.has_allergies && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Tick any known allergies</p>
                      <div className="grid grid-cols-2 gap-2">
                        {COMMON_ALLERGIES.map((allergy) => (
                          <PillCheck
                            key={allergy}
                            id={`allergy-${allergy}`}
                            label={allergy}
                            checked={allergiesList.includes(allergy)}
                            onToggle={() => toggleListItem("allergies_list", allergy)}
                          />
                        ))}
                      </div>
                      <div className="space-y-1 mt-2">
                        <Label className="text-xs">Other allergies</Label>
                        <Textarea placeholder="Any other allergies not listed above..." value={form.allergies || ""} onChange={(e) => update("allergies", e.target.value)} rows={2} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ═══ SEND ═══ */}
              <AccordionItem value="send" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={Puzzle} tile="bg-accent/10 text-accent">SEND (special educational needs)</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm">{selfMode ? "Do you have any additional needs we should know about?" : "Does your child have any special educational needs?"}</Label>
                    <Switch checked={form.has_send} onCheckedChange={(c) => update("has_send", c)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This includes children awaiting assessment or with any additional needs — emotional, physical, or developmental. Please let us know so we can provide the best support.
                  </p>

                  {form.has_send && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">SEND conditions</Label>
                        <p className="text-xs text-muted-foreground">Tick any that apply — diagnosed or awaiting assessment</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {SEND_CONDITIONS.map((condition) => (
                            <PillCheck
                              key={condition}
                              id={`send-${condition}`}
                              label={condition}
                              checked={sendConditions.includes(condition)}
                              onToggle={() => toggleSendCondition(condition)}
                            />
                          ))}
                        </div>
                      </div>

                      {sendConditions.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Triggers & coping techniques</Label>
                          <p className="text-xs text-muted-foreground">For each condition, tell us about known triggers and what works best for your child.</p>
                          {sendConditions.map((condition) => (
                            <div key={condition} className="rounded-2xl bg-card shadow-soft p-4 space-y-3">
                              <span className="text-sm font-semibold">{condition}</span>
                              <div className="space-y-1">
                                <Label className="text-xs">Known triggers</Label>
                                <Textarea placeholder={`What triggers difficulties related to ${condition}?`} value={sendTriggersCoping[condition]?.triggers || ""} onChange={(e) => updateSendDetail(condition, "triggers", e.target.value)} rows={2} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Coping techniques / how best to support</Label>
                                <Textarea placeholder="What strategies work best for your child?" value={sendTriggersCoping[condition]?.coping_techniques || ""} onChange={(e) => updateSendDetail(condition, "coping_techniques", e.target.value)} rows={2} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2"><Label>Additional SEND details</Label><Textarea placeholder="Any other information about your child's needs..." value={form.send_details || ""} onChange={(e) => update("send_details", e.target.value)} rows={2} /></div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox id="ehcp" checked={form.ehcp_in_place} onCheckedChange={(c) => update("ehcp_in_place", !!c)} />
                          <Label htmlFor="ehcp" className="text-sm cursor-pointer">EHCP (Education, Health and Care Plan) in place</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="1to1" checked={form.one_to_one_required} onCheckedChange={(c) => update("one_to_one_required", !!c)} />
                          <Label htmlFor="1to1" className="text-sm cursor-pointer">1:1 support required</Label>
                        </div>
                        {form.one_to_one_required && (
                          <Alert className="rounded-2xl border-0 bg-warning/10">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <AlertDescription className="text-sm">
                              <strong>Important:</strong> Please contact us to discuss your child's needs before booking. We want to ensure we can provide the best possible support.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ═══ TOILETING (children only) ═══ */}
              {!selfMode && (
              <AccordionItem value="toileting" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={Droplets} tile="bg-primary/10 text-primary">Toileting</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm">Is your child fully toilet trained?</Label>
                    <Switch checked={form.is_toilet_trained} onCheckedChange={(c) => update("is_toilet_trained", c)} />
                  </div>
                  {!form.is_toilet_trained && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox id="wears-nappies" checked={form.wears_nappies} onCheckedChange={(c) => update("wears_nappies", !!c)} />
                        <Label htmlFor="wears-nappies" className="text-sm cursor-pointer font-normal">My child wears nappies / pull-ups</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="prone-accidents" checked={form.prone_to_accidents} onCheckedChange={(c) => update("prone_to_accidents", !!c)} />
                        <Label htmlFor="prone-accidents" className="text-sm cursor-pointer font-normal">My child is prone to accidents</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Toileting notes</Label>
                        <Textarea placeholder="Please provide any additional details about toileting support needed..." value={form.toileting_notes || ""} onChange={(e) => update("toileting_notes", e.target.value)} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              )}

              {/* ═══ DANCE & ABOUT (children only) ═══ */}
              {!selfMode && (
              <AccordionItem value="dance" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={Sparkles} tile="bg-accent/10 text-accent">Dance & about your child</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Dance style preferences</Label>
                    <p className="text-xs text-muted-foreground">Tick all the styles your child enjoys or wants to try</p>
                    <div className="grid grid-cols-2 gap-2">
                      {["Ballet", "Tap", "Jazz", "Contemporary", "Street Dance", "Commercial", "Lyrical", "Musical Theatre", "Acro", "Ballroom", "Latin", "Not sure yet"].map(style => {
                        const selected = (form.dance_style_preference || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                        const isChecked = selected.includes(style);
                        return (
                          <PillCheck
                            key={style}
                            label={style}
                            checked={isChecked}
                            onToggle={() => {
                              const next = isChecked ? selected.filter((s: string) => s !== style) : [...selected, style];
                              update("dance_style_preference", next.join(", "));
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ability level</Label>
                    <Select value={form.ability_level || ""} onValueChange={(v) => update("ability_level", v)}>
                      <SelectTrigger><SelectValue placeholder="Select ability level" /></SelectTrigger>
                      <SelectContent>
                        {ABILITY_LEVELS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="stage-exp" checked={form.has_stage_experience} onCheckedChange={(c) => update("has_stage_experience", !!c)} />
                    <Label htmlFor="stage-exp" className="text-sm cursor-pointer font-normal">My child has stage/performance experience</Label>
                  </div>

                  {/* ─── Child's hook ─── */}
                  <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 space-y-2">
                    <p className="text-sm flex items-center gap-1.5 font-medium">
                      <Heart className="h-4 w-4 text-accent" /> What makes your child tick?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      🌟 Help us create an amazing experience! Tell us about your child's passions, favourite things to talk about, their personality, likes and dislikes — anything that helps our instructors build an instant bond.
                    </p>
                    <Textarea
                      placeholder="e.g. She loves Disney princesses, is always dancing around the house, loves glitter and sparkle, a bit shy at first but warms up quickly..."
                      value={form.child_hook || ""}
                      onChange={(e) => update("child_hook", e.target.value)}
                      rows={4}
                      className="bg-background"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              )}

              {/* ═══ CONSENT ═══ */}
              <AccordionItem value="consent" className="rounded-2xl border-0 bg-secondary/40 px-4">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <SectionHeading icon={Camera} tile="bg-success/10 text-success">Consent</SectionHeading>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="photo-consent" checked={form.photo_consent} onCheckedChange={(c) => update("photo_consent", !!c)} />
                    <Label htmlFor="photo-consent" className="text-sm cursor-pointer">I consent to photos being taken {selfMode ? "of me" : "of my child"} during classes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="social-consent" checked={form.social_media_consent} onCheckedChange={(c) => update("social_media_consent", !!c)} />
                    <Label htmlFor="social-consent" className="text-sm cursor-pointer">I consent to photos being used on social media</Label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-card/95 backdrop-blur">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.first_name || !form.last_name || !form.date_of_birth}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Save className="h-4 w-4 mr-2" />
            {selfMode ? (editing ? "Update profile" : "Save profile") : (editing ? "Update child" : "Add child")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
