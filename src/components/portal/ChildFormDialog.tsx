import { useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Camera, Loader2, Wand2 } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import DateOfBirthPicker from "@/components/portal/DateOfBirthPicker";
import { cn } from "@/lib/utils";
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

const DANCE_STYLES = ["Ballet", "Tap", "Jazz", "Contemporary", "Street Dance", "Commercial", "Lyrical", "Musical Theatre", "Acro", "Ballroom", "Latin", "Not sure yet"];

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

// ── Presentation helpers ────────────────────────────────────────────────

const INPUT = "h-12 rounded-xl text-base";
const TEXTAREA = "min-h-[88px] rounded-xl";
const SELECT_TRIGGER = "h-12 rounded-xl px-3 text-base";

/** A field label in the journey's rhythm, with a quiet required mark. */
const FieldLabel = ({ children, required, htmlFor, className }: { children: ReactNode; required?: boolean; htmlFor?: string; className?: string }) => (
  <Label htmlFor={htmlFor} className={cn("text-[13px] font-medium leading-snug text-foreground", className)}>
    {children}
    {required && <span aria-hidden className="ml-0.5 text-destructive">*</span>}
  </Label>
);

/** A yes/no switch with its question on the left. */
const SwitchRow = ({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (c: boolean) => void }) => (
  <div className="flex min-h-[44px] items-center justify-between gap-4">
    <Label className="text-sm font-medium leading-snug text-foreground">{label}</Label>
    <Switch checked={!!checked} onCheckedChange={onCheckedChange} />
  </div>
);

/** A tick-list row (medical conditions, allergies, SEND, dance styles). */
const CheckRow = ({ id, label, checked, onCheckedChange, className }: { id?: string; label: string; checked: boolean; onCheckedChange: (c: boolean) => void; className?: string }) => (
  <div className={cn("flex min-h-[40px] items-center gap-3", className)}>
    <Checkbox id={id} checked={!!checked} onCheckedChange={(c) => onCheckedChange(!!c)} className="h-5 w-5 rounded-md" />
    <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug text-foreground">{label}</Label>
  </div>
);

/** "Asthma, Eczema" / "Asthma, Eczema +2" for a section summary. */
const listSummary = (items: string[]) =>
  items.length <= 2 ? items.join(", ") : `${items.slice(0, 2).join(", ")} +${items.length - 2}`;

/** Accordion heading: the title, and a one-line summary only while collapsed. */
const SectionTrigger = ({ title, summary }: { title: string; summary: string }) => (
  <AccordionTrigger className="group py-4 text-[15px] font-semibold text-foreground hover:no-underline">
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 pr-3 text-left">
      <span>{title}</span>
      <span className="truncate text-[13px] font-normal text-muted-foreground group-data-[state=open]:hidden">{summary}</span>
    </span>
  </AccordionTrigger>
);

const SECTION_ITEM = "rounded-2xl border border-border bg-card px-5 transition-colors data-[state=open]:border-foreground/20";
const SECTION_BODY = "space-y-5 pb-5 pt-1";

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
    emergency_contact_2_name: "", emergency_contact_2_phone: "", emergency_contact_2_relationship: "",
    medical_conditions_list: [] as string[],
    has_inhaler: false, has_epipen: false,
    allergies_list: [] as string[],
    has_send: false, send_conditions_list: [] as string[], send_details: "",
    send_triggers_coping: {} as Record<string, { triggers: string; coping_techniques: string }>,
    ehcp_in_place: false, one_to_one_required: false,
    is_toilet_trained: true, toileting_notes: "", wears_nappies: false, prone_to_accidents: false,
    dance_style_preference: "", ability_level: "", has_stage_experience: false,
    child_hook: "", photo_consent: true,
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
        emergency_contact_2_name: editing.emergency_contact_2_name || "",
        emergency_contact_2_phone: editing.emergency_contact_2_phone || "",
        emergency_contact_2_relationship: editing.emergency_contact_2_relationship || "",
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
        // Single combined consent — photo_consent is the primary column and
        // drives both DB columns on save.
        photo_consent: editing.photo_consent ?? true,
        has_medical_conditions: (editing.medical_conditions_list?.length > 0 || editing.has_inhaler || editing.has_epipen || editing.medical_info),
        has_allergies: (editing.allergies_list?.length > 0 || editing.allergies),
      });
      setUploadedPhotoUrl(editing.profile_photo || null);
      setAvatarUrl(editing.avatar_url || null);
    } else {
      setForm({
        first_name: "", last_name: "", preferred_name: "", date_of_birth: "", gender: "",
        medical_info: "", allergies: "", emergency_contact_name: "", emergency_contact_phone: "",
        emergency_contact_2_name: "", emergency_contact_2_phone: "", emergency_contact_2_relationship: "",
        medical_conditions_list: [], has_inhaler: false, has_epipen: false,
        allergies_list: [], has_send: false, send_conditions_list: [], send_details: "",
        send_triggers_coping: {}, ehcp_in_place: false, one_to_one_required: false,
        is_toilet_trained: true, toileting_notes: "", wears_nappies: false, prone_to_accidents: false,
        dance_style_preference: "", ability_level: "", has_stage_experience: false,
        child_hook: "", photo_consent: true,
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

    // A backgrounded mobile tab can hold an expired access token — the write
    // would then reach the database unauthenticated and be rejected by
    // row-level security ("new row violates ... students"). Force a fresh,
    // valid session first and take the parent id from IT (never a stale
    // context value), so the token the insert uses always matches parent_id.
    let authedId = user.id;
    try {
      // getSession() refreshes an expired token when it can; if it returns
      // nothing, try an explicit refresh before giving up.
      const { data: { session } } = await supabase.auth.getSession();
      const fresh = session ?? (await supabase.auth.refreshSession()).data.session;
      if (!fresh?.user?.id) {
        setSaving(false);
        toast({
          title: "Please sign in again",
          description: "Your session has expired. Sign in and your details will be kept.",
          variant: "destructive",
        });
        return;
      }
      authedId = fresh.user.id;
    } catch {
      // Network hiccup fetching the session — fall through with the context id;
      // the insert will still be rejected safely if the token is truly invalid.
    }

    // Trim names on the way in — stray spaces broke initials on register
    // circles and pushed those students to the top of A–Z lists.
    const trimmed = (v: string) => (typeof v === "string" ? v.trim() : v);

    const payload = {
      parent_id: authedId,
      first_name: trimmed(form.first_name),
      last_name: trimmed(form.last_name),
      preferred_name: trimmed(form.preferred_name) || null,
      date_of_birth: form.date_of_birth,
      gender: form.gender || null,
      medical_info: form.medical_info || null,
      allergies: form.allergies || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      emergency_contact_2_name: form.emergency_contact_2_name || null,
      emergency_contact_2_phone: form.emergency_contact_2_phone || null,
      emergency_contact_2_relationship: form.emergency_contact_2_relationship || null,
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
      // One combined consent checkbox drives both columns, keeping them in sync.
      photo_consent: form.photo_consent,
      social_media_consent: form.photo_consent,
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
      toast({
        title: selfMode
          ? (editing ? "Profile updated!" : "Your profile is ready!")
          : (editing ? "Child updated!" : "Child added!"),
      });
      onOpenChange(false);
      onSaved();
    }
  };

  const age = getAge(form.date_of_birth);
  // Children are themed BLUE, adults PINK. Radix Select popovers portal to
  // document.body, so the theme class must also go on every SelectContent.
  const themeClass = selfMode ? "theme-adult" : "theme-children";
  // Child profiles MUST have an emergency contact with a plausible phone
  // number — mirrored by a database CHECK constraint, so this is the friendly
  // half of a rule the server enforces regardless.
  const emergencyDigits = (form.emergency_contact_phone || "").replace(/\D/g, "");
  const emergencyContactOk =
    selfMode ||
    (Boolean((form.emergency_contact_name || "").trim()) &&
      /^\+?[0-9 ()-]{7,20}$/.test((form.emergency_contact_phone || "").trim()) &&
      emergencyDigits.length >= 10 &&
      emergencyDigits.length <= 13);
  const medicalConditions = form.medical_conditions_list as string[];
  const allergiesList = form.allergies_list as string[];
  const sendConditions = form.send_conditions_list as string[];
  const sendTriggersCoping = form.send_triggers_coping as Record<string, { triggers: string; coping_techniques: string }>;

  // ── Presentation ──────────────────────────────────────────────────────

  const who = selfMode ? "you" : "your child";
  const title = selfMode
    ? (editing ? "Edit your attendee profile" : "Create your attendee profile")
    : (editing ? "Edit child" : "Add a child");
  const description = selfMode
    ? "Booking a class for yourself? We need your details for the class register — age, medical information and when you expect to arrive and leave."
    : "We use these details for the class register and to look after your child in class. Only the basics are required.";
  const saveLabel = selfMode ? (editing ? "Update profile" : "Save profile") : (editing ? "Update child" : "Add child");

  const fullName = [form.first_name, form.last_name].map((s: string) => (s || "").trim()).filter(Boolean).join(" ");
  const basicSummary = fullName ? `${fullName}${age !== null ? ` · Age ${age}` : ""}` : "Name, date of birth and emergency contact";
  const medicalParts = [...medicalConditions, form.has_inhaler && "Inhaler", form.has_epipen && "EpiPen"].filter(Boolean) as string[];
  const medicalSummary = !form.has_medical_conditions
    ? "None added"
    : medicalParts.length > 0 ? listSummary(medicalParts) : form.medical_info ? "Notes added" : "Details to add";
  const allergiesSummary = !form.has_allergies
    ? "None added"
    : allergiesList.length > 0 ? listSummary(allergiesList) : form.allergies ? "Notes added" : "Details to add";
  const sendSummary = !form.has_send
    ? "None added"
    : sendConditions.length > 0 ? listSummary(sendConditions) : form.send_details ? "Notes added" : "Details to add";
  const toiletingSummary = form.is_toilet_trained ? "Toilet trained" : "Support needed";
  const selectedStyles = (form.dance_style_preference || "").split(",").map((s: string) => s.trim()).filter(Boolean) as string[];
  const abilityLabel = ABILITY_LEVELS.find((a) => a.value === form.ability_level)?.label.split(" — ")[0];
  const danceSummary = selectedStyles.length > 0 || abilityLabel
    ? [selectedStyles.length > 0 && listSummary(selectedStyles), abilityLabel].filter(Boolean).join(" · ")
    : "Styles, ability and a little about them";
  const consentSummary = form.photo_consent ? "Photo and video consent given" : "No photo or video consent";

  const emergencyInvalid = !selfMode && !emergencyContactOk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-dialog w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground shadow-2xl sm:rounded-2xl sm:p-0",
          themeClass,
          "portal-ui",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-4 pt-6 text-left sm:text-left">
          <DialogTitle className="pr-8 text-xl font-semibold tracking-tight text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
          <div className="space-y-6 pb-6 pt-1">
            {/* ═══ PROFILE PHOTO ═══ */}
            <div className="flex flex-col items-center gap-3">
              {showCropper && photoSrc ? (
                <div className="w-full space-y-3">
                  <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-black">
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
                    <Label htmlFor="photo-zoom" className="text-[13px] font-medium text-muted-foreground">Zoom</Label>
                    <input id="photo-zoom" type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-primary" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="soft" onClick={() => setShowCropper(false)} className="h-11 flex-1 rounded-xl">Cancel</Button>
                    <Button type="button" onClick={handleCropSave} className="h-11 flex-1 rounded-xl">Save photo</Button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => document.getElementById("photo-input")?.click()}
                    aria-label={uploadedPhotoUrl ? "Change the photo" : "Add a photo"}
                    className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                  >
                    {uploadedPhotoUrl ? (
                      <img src={uploadedPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-foreground" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                      <Camera className="h-6 w-6 text-white" />
                    </span>
                  </button>
                  <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  <p className="text-[13px] text-muted-foreground">{uploadedPhotoUrl ? "Tap to change the photo" : "Add a photo (optional)"}</p>

                  {/* ═══ DANCE EXCLUSIVE AVATAR STUDIO ═══ */}
                  {uploadedPhotoUrl && editing && (
                    <div className="w-full max-w-sm space-y-3">
                      {!avatarUrl && (
                        <>
                          <Button
                            type="button"
                            variant="ink"
                            onClick={handleGenerateAvatar}
                            disabled={avatarLoading}
                            className="h-12 w-full gap-2 rounded-xl"
                          >
                            {avatarLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Creating your avatar… (about a minute)
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4" /> Create a Dance Exclusive avatar
                              </>
                            )}
                          </Button>
                          {!avatarLoading && (
                            <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
                              {selfMode
                                ? "Turn this photo into an on-brand studio portrait — you in Dance Exclusive merch under the signature pink lights."
                                : "Turn this photo into an on-brand cartoon — your child in Dance Exclusive merch, dancing on stage under the lights."}
                            </p>
                          )}
                        </>
                      )}
                      {avatarUrl && (
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                          <PhotoAvatarDuo photoUrl={uploadedPhotoUrl} avatarUrl={avatarUrl} size="lg" showLabels photoPrimary={false} expandable />
                          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
                            Both are saved — parents and staff always see the real photo and the avatar together.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {uploadedPhotoUrl && !editing && (
                    <p className="text-center text-[13px] text-muted-foreground">
                      Save the profile first to unlock the Dance Exclusive avatar studio.
                    </p>
                  )}
                </>
              )}
            </div>

            <Accordion type="multiple" defaultValue={["basic", "consent"]} className="space-y-3">
              {/* ═══ BASIC DETAILS ═══ */}
              <AccordionItem value="basic" className={SECTION_ITEM}>
                <SectionTrigger title="Basic details" summary={basicSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="child-first-name" required>First name</FieldLabel>
                      <Input id="child-first-name" className={INPUT} value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required autoComplete="off" />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="child-last-name" required>Last name</FieldLabel>
                      <Input id="child-last-name" className={INPUT} value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required autoComplete="off" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="child-preferred-name">Preferred name or nickname</FieldLabel>
                    <Input id="child-preferred-name" className={INPUT} value={form.preferred_name} onChange={(e) => update("preferred_name", e.target.value)} placeholder={selfMode ? "What do you like to be called?" : "What do they like to be called?"} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="dob-day" required>Date of birth</FieldLabel>
                      <DateOfBirthPicker
                        id="dob-day"
                        value={form.date_of_birth}
                        onChange={(v) => update("date_of_birth", v)}
                        popoverClassName={themeClass}
                      />
                      {age !== null && (
                        <p className="text-[13px] text-muted-foreground">Age {age}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="child-gender">Gender</FieldLabel>
                      <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                        <SelectTrigger id="child-gender" className={SELECT_TRIGGER}><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent className={cn("rounded-xl", themeClass)}>
                          {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border pt-5">
                    <p className="text-[13px] font-medium text-muted-foreground">Emergency contact</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="emergency-name" required={!selfMode}>Name</FieldLabel>
                        <Input id="emergency-name" className={INPUT} value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} required={!selfMode} />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="emergency-phone" required={!selfMode}>Phone</FieldLabel>
                        <Input
                          id="emergency-phone"
                          type="tel"
                          inputMode="tel"
                          className={INPUT}
                          value={form.emergency_contact_phone}
                          onChange={(e) => update("emergency_contact_phone", e.target.value)}
                          required={!selfMode}
                          placeholder="e.g. 07700 900123"
                          aria-invalid={emergencyInvalid || undefined}
                          aria-describedby={emergencyInvalid ? "emergency-contact-hint" : undefined}
                        />
                        {emergencyInvalid && (
                          <p id="emergency-contact-hint" className="text-[13px] leading-snug text-destructive">
                            An emergency contact name and a real phone number (10–13 digits) are required
                            before a child profile can be saved.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Backup contact: the studio needs someone else to try when
                      the first contact can't be reached. */}
                  <div className="space-y-4 border-t border-border pt-5">
                    <p className="text-[13px] font-medium text-muted-foreground">
                      Second emergency contact <span className="font-normal">· optional, but recommended</span>
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel htmlFor="emergency2-name">Name</FieldLabel>
                        <Input id="emergency2-name" className={INPUT} value={form.emergency_contact_2_name} onChange={(e) => update("emergency_contact_2_name", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="emergency2-phone">Phone</FieldLabel>
                        <Input id="emergency2-phone" type="tel" inputMode="tel" className={INPUT} value={form.emergency_contact_2_phone} onChange={(e) => update("emergency_contact_2_phone", e.target.value)} placeholder="e.g. 07700 900123" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="emergency2-relationship">Relationship {selfMode ? "to you" : "to the child"}</FieldLabel>
                      <Input id="emergency2-relationship" className={INPUT} value={form.emergency_contact_2_relationship} onChange={(e) => update("emergency_contact_2_relationship", e.target.value)} placeholder="e.g. Grandparent, Auntie, Childminder" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ═══ MEDICAL ═══ */}
              <AccordionItem value="medical" className={SECTION_ITEM}>
                <SectionTrigger title="Medical conditions" summary={medicalSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <SwitchRow
                    label={selfMode ? "Do you have any medical conditions?" : "Does your child have any medical conditions?"}
                    checked={form.has_medical_conditions}
                    onCheckedChange={(c) => update("has_medical_conditions", c)}
                  />

                  {form.has_medical_conditions && (
                    <>
                      <div className="space-y-2">
                        <FieldLabel>Known medical conditions</FieldLabel>
                        <p className="text-[13px] text-muted-foreground">Tick any that apply</p>
                        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                          {MEDICAL_CONDITIONS.map((condition) => (
                            <CheckRow key={condition} id={`cond-${condition}`} label={condition} checked={medicalConditions.includes(condition)} onCheckedChange={() => toggleListItem("medical_conditions_list", condition)} />
                          ))}
                        </div>
                      </div>

                      {medicalConditions.includes("Asthma") && (
                        <Alert className="rounded-xl border-warning/30 bg-warning/10 text-foreground">
                          <AlertTriangle className="h-4 w-4 !text-warning" />
                          <AlertDescription className="text-sm">
                            <strong>Inhaler required:</strong> please make sure your child brings a named inhaler to class.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-1">
                        <CheckRow id="has-inhaler" label={selfMode ? "I carry an inhaler" : "Child carries an inhaler"} checked={form.has_inhaler} onCheckedChange={(c) => update("has_inhaler", c)} />
                        <CheckRow id="has-epipen" label={selfMode ? "I carry an EpiPen" : "Child carries an EpiPen"} checked={form.has_epipen} onCheckedChange={(c) => update("has_epipen", c)} />
                        {form.has_epipen && (
                          <Alert className="mt-2 rounded-xl border-destructive/30 bg-destructive/10 text-foreground">
                            <AlertTriangle className="h-4 w-4 !text-destructive" />
                            <AlertDescription className="text-sm">
                              <strong>Important:</strong> please make sure the named EpiPen is brought to every class. Our staff include trained first aiders.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="space-y-2">
                        <FieldLabel htmlFor="medical-info">Other medical information</FieldLabel>
                        <Textarea id="medical-info" className={TEXTAREA} placeholder="Any other conditions not listed above…" value={form.medical_info || ""} onChange={(e) => update("medical_info", e.target.value)} rows={2} />
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ═══ ALLERGIES ═══ */}
              <AccordionItem value="allergies" className={SECTION_ITEM}>
                <SectionTrigger title="Allergies" summary={allergiesSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <SwitchRow
                    label={selfMode ? "Do you have any allergies?" : "Does your child have any allergies?"}
                    checked={form.has_allergies}
                    onCheckedChange={(c) => update("has_allergies", c)}
                  />

                  {form.has_allergies && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-[13px] text-muted-foreground">Tick any known allergies</p>
                        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                          {COMMON_ALLERGIES.map((allergy) => (
                            <CheckRow key={allergy} id={`allergy-${allergy}`} label={allergy} checked={allergiesList.includes(allergy)} onCheckedChange={() => toggleListItem("allergies_list", allergy)} />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="other-allergies">Other allergies</FieldLabel>
                        <Textarea id="other-allergies" className={TEXTAREA} placeholder="Any other allergies not listed above…" value={form.allergies || ""} onChange={(e) => update("allergies", e.target.value)} rows={2} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ═══ SEND ═══ */}
              <AccordionItem value="send" className={SECTION_ITEM}>
                <SectionTrigger title="SEND and additional needs" summary={sendSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <SwitchRow
                    label={selfMode ? "Do you have any additional needs we should know about?" : "Does your child have any special educational needs?"}
                    checked={form.has_send}
                    onCheckedChange={(c) => update("has_send", c)}
                  />
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    This includes children awaiting assessment or with any additional needs — emotional, physical, or developmental. Please let us know so we can provide the best support.
                  </p>

                  {form.has_send && (
                    <>
                      <div className="space-y-2">
                        <FieldLabel>SEND conditions</FieldLabel>
                        <p className="text-[13px] text-muted-foreground">Tick any that apply — diagnosed or awaiting assessment</p>
                        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                          {SEND_CONDITIONS.map((condition) => (
                            <CheckRow key={condition} id={`send-${condition}`} label={condition} checked={sendConditions.includes(condition)} onCheckedChange={() => toggleSendCondition(condition)} />
                          ))}
                        </div>
                      </div>

                      {sendConditions.length > 0 && (
                        <div className="space-y-3">
                          <FieldLabel>Triggers and coping techniques</FieldLabel>
                          <p className="text-[13px] text-muted-foreground">For each condition, tell us about known triggers and what works best for {who}.</p>
                          {sendConditions.map((condition) => (
                            <div key={condition} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
                              <span className="text-sm font-semibold text-foreground">{condition}</span>
                              <div className="space-y-2">
                                <FieldLabel htmlFor={`send-trigger-${condition}`}>Known triggers</FieldLabel>
                                <Textarea id={`send-trigger-${condition}`} className={cn(TEXTAREA, "bg-card")} placeholder={`What triggers difficulties related to ${condition}?`} value={sendTriggersCoping[condition]?.triggers || ""} onChange={(e) => updateSendDetail(condition, "triggers", e.target.value)} rows={2} />
                              </div>
                              <div className="space-y-2">
                                <FieldLabel htmlFor={`send-coping-${condition}`}>Coping techniques and how best to support</FieldLabel>
                                <Textarea id={`send-coping-${condition}`} className={cn(TEXTAREA, "bg-card")} placeholder={`What strategies work best for ${who}?`} value={sendTriggersCoping[condition]?.coping_techniques || ""} onChange={(e) => updateSendDetail(condition, "coping_techniques", e.target.value)} rows={2} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <FieldLabel htmlFor="send-details">Additional SEND details</FieldLabel>
                        <Textarea id="send-details" className={TEXTAREA} placeholder={`Any other information about ${selfMode ? "your" : "your child's"} needs…`} value={form.send_details || ""} onChange={(e) => update("send_details", e.target.value)} rows={2} />
                      </div>

                      <div className="space-y-1">
                        <CheckRow id="ehcp" label="EHCP (Education, Health and Care Plan) in place" checked={form.ehcp_in_place} onCheckedChange={(c) => update("ehcp_in_place", c)} />
                        <CheckRow id="1to1" label="1:1 support required" checked={form.one_to_one_required} onCheckedChange={(c) => update("one_to_one_required", c)} />
                        {form.one_to_one_required && (
                          <Alert className="mt-2 rounded-xl border-warning/30 bg-warning/10 text-foreground">
                            <AlertTriangle className="h-4 w-4 !text-warning" />
                            <AlertDescription className="text-sm">
                              <strong>Important:</strong> please contact us to discuss your child's needs before booking. We want to make sure we can provide the best possible support.
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
              <AccordionItem value="toileting" className={SECTION_ITEM}>
                <SectionTrigger title="Toileting" summary={toiletingSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <SwitchRow label="Is your child fully toilet trained?" checked={form.is_toilet_trained} onCheckedChange={(c) => update("is_toilet_trained", c)} />
                  {!form.is_toilet_trained && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <CheckRow id="wears-nappies" label="My child wears nappies / pull-ups" checked={form.wears_nappies} onCheckedChange={(c) => update("wears_nappies", c)} />
                        <CheckRow id="prone-accidents" label="My child is prone to accidents" checked={form.prone_to_accidents} onCheckedChange={(c) => update("prone_to_accidents", c)} />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel htmlFor="toileting-notes">Toileting notes</FieldLabel>
                        <Textarea id="toileting-notes" className={TEXTAREA} placeholder="Any details about the toileting support needed…" value={form.toileting_notes || ""} onChange={(e) => update("toileting_notes", e.target.value)} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              )}

              {/* ═══ DANCE & ABOUT (children only) ═══ */}
              {!selfMode && (
              <AccordionItem value="dance" className={SECTION_ITEM}>
                <SectionTrigger title="Dance and about your child" summary={danceSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <div className="space-y-2">
                    <FieldLabel>Dance style preferences</FieldLabel>
                    <p className="text-[13px] text-muted-foreground">Tick all the styles your child enjoys or wants to try</p>
                    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                      {DANCE_STYLES.map(style => {
                        const selected = (form.dance_style_preference || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                        const isChecked = selected.includes(style);
                        return (
                          <CheckRow
                            key={style}
                            id={`style-${style}`}
                            label={style}
                            checked={isChecked}
                            onCheckedChange={() => {
                              const next = isChecked ? selected.filter((s: string) => s !== style) : [...selected, style];
                              update("dance_style_preference", next.join(", "));
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="ability-level">Ability level</FieldLabel>
                    <Select value={form.ability_level || ""} onValueChange={(v) => update("ability_level", v)}>
                      <SelectTrigger id="ability-level" className={SELECT_TRIGGER}><SelectValue placeholder="Select ability level" /></SelectTrigger>
                      <SelectContent className={cn("rounded-xl", themeClass)}>
                        {ABILITY_LEVELS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <CheckRow id="stage-exp" label="My child has stage or performance experience" checked={form.has_stage_experience} onCheckedChange={(c) => update("has_stage_experience", c)} />

                  {/* ─── About Your Child ─── */}
                  <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
                    <FieldLabel htmlFor="child-hook">Tell us about your child</FieldLabel>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Share their passions, favourite things to talk about, their personality, likes and dislikes — anything that helps our instructors build an instant bond.
                    </p>
                    <Textarea
                      id="child-hook"
                      placeholder="e.g. She loves Disney princesses, is always dancing around the house, loves glitter and sparkle, a bit shy at first but warms up quickly…"
                      value={form.child_hook || ""}
                      onChange={(e) => update("child_hook", e.target.value)}
                      rows={4}
                      className={cn(TEXTAREA, "bg-card")}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              )}

              {/* ═══ CONSENT ═══ */}
              <AccordionItem value="consent" className={SECTION_ITEM}>
                <SectionTrigger title="Consent" summary={consentSummary} />
                <AccordionContent className={SECTION_BODY}>
                  <div className="flex items-start gap-3">
                    <Checkbox id="photo-consent" className="mt-0.5 h-5 w-5 rounded-md" checked={form.photo_consent} onCheckedChange={(c) => update("photo_consent", !!c)} />
                    <Label htmlFor="photo-consent" className="cursor-pointer text-sm font-normal leading-relaxed text-foreground">
                      I consent to photos and videos being taken during classes and used in The Dance Exclusive's marketing, including social media
                    </Label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-6 py-4">
          <Button type="button" variant="soft" size="xl" className="rounded-xl px-5" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            size="xl"
            className="rounded-xl px-6"
            onClick={handleSave}
            disabled={saving || !form.first_name || !form.last_name || !form.date_of_birth || !emergencyContactOk}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
