import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, User, Users, MapPin, ShieldCheck, Pencil, Trash2, Camera, Sparkles, Baby, PartyPopper, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

const ABILITY_LEVELS = [
  { value: "newcomer", label: "Newcomer — Never danced before" },
  { value: "learning", label: "Learning — Just started" },
  { value: "progressive", label: "Progressive — Building skills" },
  { value: "experienced", label: "Experienced — Confident dancer" },
];

const GENDER_OPTIONS = [
  "Female", "Male", "Non-binary", "Prefer not to say", "Other",
];

const DANCE_STYLES = [
  "Ballet", "Tap", "Jazz", "Contemporary", "Street Dance", "Commercial",
  "Lyrical", "Musical Theatre", "Acro", "Ballroom", "Latin", "Not sure yet",
];

const MEDICAL_CONDITIONS = [
  "Asthma", "Epilepsy", "Diabetes", "Heart condition", "Joint/bone issues",
  "Back problems", "Anxiety/panic attacks", "Vertigo/dizziness",
  "High blood pressure", "Low blood pressure",
];

const ALLERGY_OPTIONS = [
  "Nuts", "Dairy", "Gluten", "Eggs", "Soya", "Latex", "Plasters/adhesives", "Other",
];

type CustomerType = "parent_only" | "adult_dancer" | "both";

interface ProfileData {
  full_name: string;
  preferred_name: string | null;
  email: string;
  phone: string | null;
  secondary_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  profile_photo: string | null;
  dance_experience: string | null;
  ability_level: string | null;
  customer_type: string | null;
  date_of_birth: string | null;
  gender: string | null;
  medical_info: string | null;
  medical_conditions_list: string[];
  has_inhaler: boolean;
  has_epipen: boolean;
  allergies_list: string[];
  dance_style_preference: string | null;
}

interface Collector {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  student_id: string;
  parent_id: string;
}

const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; icon: React.ReactNode; title: string; description: string }[] = [
  {
    value: "parent_only",
    icon: <Users className="w-10 h-10 text-primary" />,
    title: "My children want to dance!",
    description: "I'm here to book classes for my kids",
  },
  {
    value: "adult_dancer",
    icon: <User className="w-10 h-10 text-primary" />,
    title: "I'm the one who wants to dance!",
    description: "Sign me up — no kids, just me and the music",
  },
  {
    value: "both",
    icon: <Heart className="w-10 h-10 text-primary" />,
    title: "We ALL want to dance!",
    description: "Classes for my children AND for me — let's go!",
  },
];

const DEFAULT_PROFILE: ProfileData = {
  full_name: "", preferred_name: null, email: "", phone: null, secondary_phone: null,
  address_line1: null, address_line2: null, city: null, county: null, postcode: null,
  profile_photo: null, dance_experience: null, ability_level: null,
  customer_type: null, date_of_birth: null, gender: null,
  medical_info: null, medical_conditions_list: [], has_inhaler: false, has_epipen: false,
  allergies_list: [], dance_style_preference: null,
};

const Account = () => {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileData>({ ...DEFAULT_PROFILE });
  const [children, setChildren] = useState<any[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [collectorDialogOpen, setCollectorDialogOpen] = useState(false);
  const { toast } = useToast();

  const [editingChild, setEditingChild] = useState<any>(null);
  const [selfProfile, setSelfProfile] = useState<any>(null);
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [childBookingCounts, setChildBookingCounts] = useState<Record<string, number>>({});

  // Parent photo crop state
  const [parentPhotoSrc, setParentPhotoSrc] = useState<string | null>(null);
  const [parentCrop, setParentCrop] = useState({ x: 0, y: 0 });
  const [parentZoom, setParentZoom] = useState(1);
  const [parentCroppedArea, setParentCroppedArea] = useState<Area | null>(null);
  const [showParentCropper, setShowParentCropper] = useState(false);

  const [collectorForm, setCollectorForm] = useState({
    name: "", email: "", phone: "", relationship: "", student_ids: [] as string[],
  });

  const customerType = (profileForm.customer_type || profile?.customer_type) as CustomerType | null;
  const showChildren = customerType === "parent_only" || customerType === "both";
  const showAdultDance = customerType === "adult_dancer" || customerType === "both";

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, preferred_name, email, phone, secondary_phone, address_line1, address_line2, city, county, postcode, profile_photo, dance_experience, ability_level, customer_type, date_of_birth, gender, medical_info, medical_conditions_list, has_inhaler, has_epipen, allergies_list, dance_style_preference")
      .eq("user_id", user.id)
      .single();
    if (data) {
      const d = data as any;
      const pd: ProfileData = {
        ...DEFAULT_PROFILE,
        ...d,
        medical_conditions_list: d.medical_conditions_list || [],
        allergies_list: d.allergies_list || [],
        has_inhaler: d.has_inhaler ?? false,
        has_epipen: d.has_epipen ?? false,
      };
      setProfile(pd);
      setProfileForm(pd);
    }
  };

  const fetchChildren = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("*").eq("parent_id", user.id).order("first_name");
    if (data) {
      // The adult's own attendee profile (is_self) lives in the same table
      // but is managed separately — keep it out of the Children list.
      setChildren(data.filter((s: any) => !s.is_self));
      setSelfProfile(data.find((s: any) => s.is_self) ?? null);
    }
  };

  const fetchCollectors = async () => {
    if (!user) return;
    const { data } = await supabase.from("authorized_collectors").select("*").eq("parent_id", user.id).order("name");
    if (data) setCollectors(data as Collector[]);
  };

  const fetchChildBookingCounts = async () => {
    if (!user) return;
    const { data } = await supabase.from("bookings").select("student_id").eq("parent_id", user.id);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((b: any) => { if (b.student_id) counts[b.student_id] = (counts[b.student_id] || 0) + 1; });
      setChildBookingCounts(counts);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchChildren();
    fetchCollectors();
    fetchChildBookingCounts();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: profileForm.full_name,
      preferred_name: profileForm.preferred_name || null,
      phone: profileForm.phone || null,
      secondary_phone: profileForm.secondary_phone || null,
      address_line1: profileForm.address_line1 || null,
      address_line2: profileForm.address_line2 || null,
      city: profileForm.city || null,
      county: profileForm.county || null,
      postcode: profileForm.postcode || null,
      profile_photo: profileForm.profile_photo || null,
      dance_experience: profileForm.dance_experience || null,
      ability_level: profileForm.ability_level || null,
      customer_type: profileForm.customer_type || null,
      date_of_birth: profileForm.date_of_birth || null,
      gender: profileForm.gender || null,
      medical_info: profileForm.medical_info || null,
      medical_conditions_list: profileForm.medical_conditions_list,
      has_inhaler: profileForm.has_inhaler,
      has_epipen: profileForm.has_epipen,
      allergies_list: profileForm.allergies_list,
      dance_style_preference: profileForm.dance_style_preference || null,
    }).eq("user_id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Profile updated!" });
      setEditingProfile(false);
      fetchProfile();
    }
  };

  const handleSetCustomerType = async (type: CustomerType) => {
    if (!user) return;
    setProfileForm(prev => ({ ...prev, customer_type: type }));
    const { error } = await supabase.from("profiles").update({ customer_type: type }).eq("user_id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Great choice! 🎉" });
      fetchProfile();
      void refreshProfile();
    }
  };

  const getAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const handleAddCollector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || collectorForm.student_ids.length === 0) return;

    if (editingCollector) {
      // Update existing collector
      const { error } = await supabase.from("authorized_collectors").update({
        name: collectorForm.name,
        email: collectorForm.email || null,
        phone: collectorForm.phone || null,
        relationship: collectorForm.relationship,
      }).eq("id", editingCollector.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Authorised person updated!" });
        setCollectorDialogOpen(false);
        setEditingCollector(null);
        setCollectorForm({ name: "", email: "", phone: "", relationship: "", student_ids: [] });
        fetchCollectors();
      }
      return;
    }

    const rows = collectorForm.student_ids.map(sid => ({
      parent_id: user.id,
      student_id: sid,
      name: collectorForm.name,
      email: collectorForm.email || null,
      phone: collectorForm.phone || null,
      relationship: collectorForm.relationship,
    }));
    const { error } = await supabase.from("authorized_collectors").insert(rows);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Authorised person added!" });
      setCollectorDialogOpen(false);
      setCollectorForm({ name: "", email: "", phone: "", relationship: "", student_ids: [] });
      fetchCollectors();
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (childBookingCounts[childId]) {
      toast({ title: "Cannot remove", description: "This child has existing bookings and cannot be removed.", variant: "destructive" });
      return;
    }
    // Also delete associated collectors
    await supabase.from("authorized_collectors").delete().eq("student_id", childId);
    const { error } = await supabase.from("students").delete().eq("id", childId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Child removed" });
      fetchChildren();
      fetchCollectors();
      fetchChildBookingCounts();
    }
  };

  const handleEditCollector = (group: Collector[]) => {
    const c = group[0];
    setEditingCollector(c);
    setCollectorForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      relationship: c.relationship,
      student_ids: group.map(g => g.student_id),
    });
    setCollectorDialogOpen(true);
  };

  const handleDeleteCollector = async (id: string) => {
    const { error } = await supabase.from("authorized_collectors").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Removed" });
      fetchCollectors();
    }
  };

  const getChildName = (studentId: string) => {
    const child = children.find((c) => c.id === studentId);
    return child ? `${child.first_name} ${child.last_name}` : "Unknown";
  };

  // Parent photo handlers
  const handleParentPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setParentPhotoSrc(reader.result as string);
      setShowParentCropper(true);
      setParentCrop({ x: 0, y: 0 });
      setParentZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onParentCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setParentCroppedArea(croppedAreaPixels);
  }, []);

  const handleParentCropSave = async () => {
    if (!parentPhotoSrc || !parentCroppedArea || !user) return;
    try {
      const blob = await getCroppedImg(parentPhotoSrc, parentCroppedArea);
      const path = `${user.id}/profile-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(path);
      setProfileForm(prev => ({ ...prev, profile_photo: publicUrl }));
      setShowParentCropper(false);
      toast({ title: "Photo uploaded! Click Save Profile to keep it." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const toggleListItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];

  // --- Customer Type Selector (shown if not yet chosen or if editing) ---
  const renderCustomerTypeSelector = () => (
    <Card className="mb-8 overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 pb-4 text-center">
          <h2 className="text-2xl font-display font-bold mb-1">Welcome! Tell us about you ✨</h2>
          <p className="text-muted-foreground text-sm">What brings you to The Dance Exclusive?</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-border">
          {CUSTOMER_TYPE_OPTIONS.map((opt) => {
            const isSelected = customerType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSetCustomerType(opt.value)}
                className={`relative flex flex-col items-center text-center p-6 md:p-8 transition-all duration-300 border-r last:border-r-0 border-border hover:bg-primary/5 group ${
                  isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""
                }`}
              >
                <span className="mb-3 group-hover:scale-110 transition-transform duration-200">{opt.icon}</span>
                <span className="font-bold text-sm mb-1">{opt.title}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{opt.description}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">Selected</Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  // --- Adult Dance & Medical Section (edit mode) ---
  const renderAdultDanceSection = () => (
    <>
      {/* Personal Details */}
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><User className="w-4 h-4" /> Personal Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={profileForm.date_of_birth || ""}
              onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
            />
            {profileForm.date_of_birth && (
              <p className="text-xs text-muted-foreground">Age: {getAge(profileForm.date_of_birth)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={profileForm.gender || ""} onValueChange={(v) => setProfileForm({ ...profileForm, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dance Experience */}
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><Sparkles className="w-4 h-4" /> Dance Experience</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Current Level</Label>
            <Select value={profileForm.ability_level || ""} onValueChange={(v) => setProfileForm({ ...profileForm, ability_level: v })}>
              <SelectTrigger><SelectValue placeholder="Select your level" /></SelectTrigger>
              <SelectContent>
                {ABILITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>What dance styles interest you?</Label>
            <Select value={profileForm.dance_style_preference || ""} onValueChange={(v) => setProfileForm({ ...profileForm, dance_style_preference: v })}>
              <SelectTrigger><SelectValue placeholder="Select preferred style" /></SelectTrigger>
              <SelectContent>
                {DANCE_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Previous Dance Experience</Label>
            <Textarea
              value={profileForm.dance_experience || ""}
              onChange={(e) => setProfileForm({ ...profileForm, dance_experience: e.target.value })}
              placeholder="Tell us about your dance background — styles, how long, performances..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Medical Information */}
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><Heart className="w-4 h-4" /> Health & Medical</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Do any of these apply to you?</Label>
            <div className="grid grid-cols-2 gap-2">
              {MEDICAL_CONDITIONS.map(cond => (
                <label key={cond} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={profileForm.medical_conditions_list.includes(cond)}
                    onCheckedChange={() => setProfileForm(prev => ({
                      ...prev,
                      medical_conditions_list: toggleListItem(prev.medical_conditions_list, cond),
                    }))}
                  />
                  {cond}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Anything else we should know?</Label>
            <Textarea
              value={profileForm.medical_info || ""}
              onChange={(e) => setProfileForm({ ...profileForm, medical_info: e.target.value })}
              placeholder="Any other medical conditions, injuries, or things we should be aware of..."
              rows={2}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={profileForm.has_inhaler}
                onCheckedChange={(c) => setProfileForm(prev => ({ ...prev, has_inhaler: !!c }))}
              />
              I carry an inhaler
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={profileForm.has_epipen}
                onCheckedChange={(c) => setProfileForm(prev => ({ ...prev, has_epipen: !!c }))}
              />
              I carry an EpiPen
            </label>
          </div>
          {(profileForm.has_inhaler || profileForm.has_epipen) && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              💡 Please remember to bring your {[profileForm.has_inhaler && "inhaler", profileForm.has_epipen && "EpiPen"].filter(Boolean).join(" and ")} to every class.
            </p>
          )}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Any allergies?</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALLERGY_OPTIONS.map(a => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={profileForm.allergies_list.includes(a)}
                    onCheckedChange={() => setProfileForm(prev => ({
                      ...prev,
                      allergies_list: toggleListItem(prev.allergies_list, a),
                    }))}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // --- Adult Dance & Medical Section (read-only view) ---
  const renderAdultDanceReadOnly = () => {
    if (!profile) return null;
    const hasPersonal = profile.date_of_birth || profile.gender;
    const hasDance = profile.ability_level || profile.dance_experience || profile.dance_style_preference;
    const hasMedical = (profile.medical_conditions_list?.length > 0) || profile.medical_info || profile.has_inhaler || profile.has_epipen || (profile.allergies_list?.length > 0);
    if (!hasPersonal && !hasDance && !hasMedical) return null;

    return (
      <>
        {hasPersonal && (
          <div className="border-t border-border pt-3 text-sm">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Personal Details</p>
            <div className="flex gap-4 flex-wrap">
              {profile.date_of_birth && <span className="font-medium">DOB: {format(new Date(profile.date_of_birth), "d MMM yyyy")} (Age {getAge(profile.date_of_birth)})</span>}
              {profile.gender && <Badge variant="secondary" className="text-xs">{profile.gender}</Badge>}
            </div>
          </div>
        )}
        {hasDance && (
          <div className="border-t border-border pt-3 text-sm">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Dance Experience</p>
            <div className="flex gap-2 flex-wrap">
              {profile.ability_level && <Badge variant="secondary" className="capitalize">{profile.ability_level}</Badge>}
              {profile.dance_style_preference && <Badge variant="outline">{profile.dance_style_preference}</Badge>}
            </div>
            {profile.dance_experience && <p className="font-medium mt-1">{profile.dance_experience}</p>}
          </div>
        )}
        {hasMedical && (
          <div className="border-t border-border pt-3 text-sm">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> Health & Medical</p>
            <div className="flex gap-1.5 flex-wrap">
              {profile.medical_conditions_list?.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
              {profile.has_inhaler && <Badge variant="outline" className="text-xs">Inhaler</Badge>}
              {profile.has_epipen && <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">EpiPen</Badge>}
              {profile.allergies_list?.map(a => <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>)}
            </div>
            {profile.medical_info && <p className="font-medium mt-1">{profile.medical_info}</p>}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-display font-bold mb-8">My Account</h1>

      {/* Customer Type Selector */}
      {renderCustomerTypeSelector()}

      {/* Profile Section */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Profile</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setEditingProfile(!editingProfile)}>
            <Pencil className="w-4 h-4 mr-1" /> {editingProfile ? "Cancel" : "Edit"}
          </Button>
        </CardHeader>
        <CardContent>
          {editingProfile ? (
            <div className="space-y-4">
              {/* Profile Photo Upload */}
              <div className="flex flex-col items-center gap-3">
                {showParentCropper && parentPhotoSrc ? (
                  <div className="w-full space-y-3">
                    <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
                      <Cropper
                        image={parentPhotoSrc}
                        crop={parentCrop}
                        zoom={parentZoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setParentCrop}
                        onZoomChange={setParentZoom}
                        onCropComplete={onParentCropComplete}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground">Zoom</Label>
                      <input type="range" min={1} max={3} step={0.1} value={parentZoom} onChange={(e) => setParentZoom(Number(e.target.value))} className="flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowParentCropper(false)} className="flex-1">Cancel</Button>
                      <Button size="sm" onClick={handleParentCropSave} className="flex-1">Save Photo</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden group cursor-pointer"
                      onClick={() => document.getElementById("parent-photo-input")?.click()}>
                      {profileForm.profile_photo ? (
                        <img src={profileForm.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <input id="parent-photo-input" type="file" accept="image/*" className="hidden" onChange={handleParentPhotoSelect} />
                    <p className="text-xs text-muted-foreground">Click to upload profile photo</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Name / Nickname</Label>
                  <Input value={profileForm.preferred_name || ""} onChange={(e) => setProfileForm({ ...profileForm, preferred_name: e.target.value })} placeholder="What do you like to be called?" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profileForm.email} disabled className="opacity-60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={profileForm.phone || ""} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Primary phone" />
                </div>
                <div className="space-y-2">
                  <Label>Secondary Phone</Label>
                  <Input value={profileForm.secondary_phone || ""} onChange={(e) => setProfileForm({ ...profileForm, secondary_phone: e.target.value })} placeholder="Secondary phone" />
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><MapPin className="w-4 h-4" /> Home Address</h3>
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Address Line 1</Label><Input value={profileForm.address_line1 || ""} onChange={(e) => setProfileForm({ ...profileForm, address_line1: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Address Line 2</Label><Input value={profileForm.address_line2 || ""} onChange={(e) => setProfileForm({ ...profileForm, address_line2: e.target.value })} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>City / Town</Label><Input value={profileForm.city || ""} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} /></div>
                    <div className="space-y-2"><Label>County</Label><Input value={profileForm.county || ""} onChange={(e) => setProfileForm({ ...profileForm, county: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Postcode</Label><Input value={profileForm.postcode || ""} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value })} /></div>
                  </div>
                </div>
              </div>

              {/* Only show adult dance/medical if they're an adult dancer or both */}
              {showAdultDance && renderAdultDanceSection()}

              <Button onClick={handleSaveProfile} className="w-full">Save Profile</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {profile?.profile_photo ? (
                  <img src={profile.profile_photo} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-lg">{profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  {customerType && (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {CUSTOMER_TYPE_OPTIONS.find(o => o.value === customerType)?.title}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{profile?.phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Secondary Phone:</span> <span className="font-medium">{profile?.secondary_phone || "—"}</span></div>
              </div>
              {(profile?.address_line1 || profile?.postcode) && (
                <div className="border-t border-border pt-3 text-sm">
                  <p className="text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Address</p>
                  <p className="font-medium">
                    {[profile.address_line1, profile.address_line2, profile.city, profile.county, profile.postcode].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
              {showAdultDance && renderAdultDanceReadOnly()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adult attendee profile — required before booking classes for yourself */}
      {showAdultDance && (
        <Card className="mb-8">
          <CardContent className="py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-display font-semibold flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5" /> My Attendee Profile
                </h2>
                {selfProfile ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <PhotoAvatarDuo
                      photoUrl={selfProfile.profile_photo}
                      avatarUrl={selfProfile.avatar_url}
                      initials={`${selfProfile.first_name?.[0] ?? ""}${selfProfile.last_name?.[0] ?? ""}`}
                      size="sm"
                    />
                    <p>
                      <span className="text-foreground font-medium">{selfProfile.first_name} {selfProfile.last_name}</span>
                      {" · "}Age {getAge(selfProfile.date_of_birth)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Booking classes for yourself? Create your attendee profile (age and medical
                    info) — it's required before you can book, and it's what our instructors see
                    on the class register.
                  </p>
                )}
              </div>
              <Button size="sm" variant={selfProfile ? "outline" : "default"} onClick={() => setSelfDialogOpen(true)}>
                {selfProfile ? "Edit Profile" : "Create Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ChildFormDialog
        open={selfDialogOpen}
        onOpenChange={setSelfDialogOpen}
        onSaved={fetchChildren}
        editing={selfProfile}
        selfMode
      />

      {/* Children Section — only if parent_only or both */}
      {showChildren && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" /> Children
            </h2>
            <Button size="sm" onClick={() => { setEditingChild(null); setChildDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Child
            </Button>
          </div>

          <ChildFormDialog
            open={childDialogOpen}
            onOpenChange={setChildDialogOpen}
            onSaved={fetchChildren}
            editing={editingChild}
          />

          {children.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No children added yet. Add your child's details to start booking classes.</CardContent></Card>
          ) : (
            <div className="space-y-3 mb-8">
              {children.map((c) => (
                <Card key={c.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="cursor-pointer flex-1 flex items-start gap-4" onClick={() => { setEditingChild(c); setChildDialogOpen(true); }}>
                        <PhotoAvatarDuo
                          photoUrl={c.profile_photo}
                          avatarUrl={c.avatar_url}
                          initials={`${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{c.first_name} {c.last_name}</h3>
                            {c.preferred_name && <span className="text-xs text-muted-foreground">"{c.preferred_name}"</span>}
                            <span className="text-xs text-muted-foreground">Age {getAge(c.date_of_birth)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">DOB: {format(new Date(c.date_of_birth), "d MMM yyyy")}{c.gender && ` • ${c.gender}`}</p>
                          <div className="flex gap-1.5 flex-wrap mt-1.5">
                            {c.has_send && <Badge variant="outline" className="text-xs">SEND</Badge>}
                            {(c.medical_conditions_list?.length > 0 || c.medical_info) && <Badge variant="outline" className="text-xs">Medical</Badge>}
                            {(c.allergies_list?.length > 0 || c.allergies) && <Badge variant="destructive" className="text-xs">Allergies</Badge>}
                            {c.has_inhaler && <Badge variant="outline" className="text-xs">Inhaler</Badge>}
                            {c.has_epipen && <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">EpiPen</Badge>}
                            {!c.is_toilet_trained && <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">Toileting</Badge>}
                            {c.ability_level && <Badge variant="secondary" className="text-xs capitalize">{c.ability_level}</Badge>}
                          </div>
                        </div>
                        <Pencil className="w-4 h-4 text-muted-foreground mt-1" />
                      </div>
                      {!childBookingCounts[c.id] && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive mt-1"
                          onClick={(e) => { e.stopPropagation(); handleDeleteChild(c.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Authorised Collectors Section */}
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Authorised Collectors
            </h2>
            <Dialog open={collectorDialogOpen} onOpenChange={(open) => {
              setCollectorDialogOpen(open);
              if (!open) {
                setEditingCollector(null);
                setCollectorForm({ name: "", email: "", phone: "", relationship: "", student_ids: [] });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={children.length === 0}><Plus className="w-4 h-4 mr-2" /> Add Person</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingCollector ? "Edit" : "Add"} Authorised Person</DialogTitle></DialogHeader>
                <form onSubmit={handleAddCollector} className="space-y-4">
                  {!editingCollector && (
                    <div className="space-y-2">
                      <Label>Which children can they collect?</Label>
                      <div className="space-y-2">
                        {children.length > 1 && (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={collectorForm.student_ids.length === children.length}
                              onCheckedChange={(checked) => {
                                setCollectorForm(prev => ({
                                  ...prev,
                                  student_ids: checked ? children.map((c: any) => c.id) : [],
                                }));
                              }}
                            />
                            <span className="font-medium">All children</span>
                          </label>
                        )}
                        {children.map((c: any) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={collectorForm.student_ids.includes(c.id)}
                              onCheckedChange={() => {
                                setCollectorForm(prev => ({
                                  ...prev,
                                  student_ids: prev.student_ids.includes(c.id)
                                    ? prev.student_ids.filter(id => id !== c.id)
                                    : [...prev.student_ids, c.id],
                                }));
                              }}
                            />
                            {c.first_name} {c.last_name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2"><Label>Full Name</Label><Input value={collectorForm.name} onChange={(e) => setCollectorForm({ ...collectorForm, name: e.target.value })} required /></div>
                  <div className="space-y-2">
                    <Label>Relationship to Child</Label>
                    <Select value={collectorForm.relationship} onValueChange={(v) => setCollectorForm({ ...collectorForm, relationship: v })}>
                      <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                      <SelectContent>
                        {["Mum", "Dad", "Grandparent", "Grandmother", "Grandfather", "Auntie", "Uncle", "Sister", "Brother", "Step-parent", "Foster parent", "Childminder", "Nanny", "Family friend", "Other"].map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={collectorForm.email} onChange={(e) => setCollectorForm({ ...collectorForm, email: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Provide the email if you wish for the authorised collector to also receive the QR code via email</p>
                    </div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={collectorForm.phone} onChange={(e) => setCollectorForm({ ...collectorForm, phone: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={collectorForm.student_ids.length === 0 || !collectorForm.relationship}>
                    {editingCollector ? "Save Changes" : "Add Authorised Person"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {children.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">Add a child first before adding authorised collectors.</CardContent></Card>
          ) : collectors.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No authorised collectors added yet. Add people who are permitted to collect your children.</CardContent></Card>
          ) : (
          <div className="space-y-3">
              {(() => {
                const grouped = collectors.reduce<Record<string, typeof collectors>>((acc, c) => {
                  const key = `${c.name}||${c.relationship}||${c.phone || ""}||${c.email || ""}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(c);
                  return acc;
                }, {});
                return Object.values(grouped).map((group) => {
                  const c = group[0];
                  const childNames = group.map(g => getChildName(g.student_id)).filter(Boolean).join(", ");
                  const handleDeleteGroup = async () => {
                    for (const entry of group) {
                      await supabase.from("authorized_collectors").delete().eq("id", entry.id);
                    }
                    toast({ title: "Deleted", description: "Authorised collector removed." });
                    fetchCollectors();
                  };
                  return (
                    <Card key={group.map(g => g.id).join("-")}>
                      <CardContent className="py-4 flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{c.name}</h3>
                          <p className="text-sm text-muted-foreground">{c.relationship} — for {childNames}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                            {c.phone && <span>{c.phone}</span>}
                            {c.email && <span>{c.email}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCollector(group)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={handleDeleteGroup} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <Button asChild variant="outline">
          <Link to="/account/bookings">View My Bookings →</Link>
        </Button>
      </div>
    </div>
  );
};

export default Account;
