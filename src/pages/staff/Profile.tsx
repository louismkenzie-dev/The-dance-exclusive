import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffMember, getStaffPhotoUrl } from "@/hooks/useStaffMember";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FadeRise } from "@/components/motion";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, User } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

const StaffProfile = () => {
  const { staff, refresh } = useStaffMember();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  // Profile photo crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    if (staff) setForm({
      first_name: staff.first_name || "",
      last_name: staff.last_name || "",
      email: staff.email || "",
      phone: staff.phone || "",
      date_of_birth: staff.date_of_birth || "",
      address_line1: staff.address_line1 || "",
      address_line2: staff.address_line2 || "",
      city: staff.city || "",
      county: staff.county || "",
      postcode: staff.postcode || "",
      next_of_kin_name: staff.next_of_kin_name || "",
      next_of_kin_phone: staff.next_of_kin_phone || "",
      next_of_kin_relationship: staff.next_of_kin_relationship || "",
      description: staff.description || "",
      profile_photo: staff.profile_photo || "",
    });
  }, [staff?.id]);

  if (!staff) return <div className="p-6 md:p-8 text-muted-foreground">Loading...</div>;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
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
  };

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (!cropSrc || !croppedArea || !staff) return;
    setUploading(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedArea);
      const path = `${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from("staff-photos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      setForm({ ...form, profile_photo: path });
      await supabase.from("staff").update({ profile_photo: path }).eq("id", staff.id);
      void refresh();
      setShowCropper(false);
      setCropSrc(null);
      toast({ title: "Photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const fullName = `${form.first_name} ${form.last_name}`.trim();
    const { error } = await supabase.from("staff").update({
      ...form,
      full_name: fullName,
      date_of_birth: form.date_of_birth || null,
    }).eq("id", staff.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Profile saved" }); void refresh(); }
  };

  const photo = form.profile_photo ? getStaffPhotoUrl(form.profile_photo) : undefined;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <FadeRise>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">My profile</h1>
        <p className="text-muted-foreground mt-1">Update your personal details</p>
      </FadeRise>

      <FadeRise delay={80}>
        <Card>
          <CardContent className="p-6 space-y-5">
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
                  <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-primary" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowCropper(false); setCropSrc(null); }} className="flex-1">Cancel</Button>
                  <Button type="button" size="sm" onClick={handleCropSave} disabled={uploading} className="flex-1">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save photo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <label className="relative group cursor-pointer">
                  <Avatar className="w-24 h-24 border-2 border-border/60">
                    <AvatarImage src={photo} />
                    <AvatarFallback className="bg-secondary"><User className="w-10 h-10 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
                <div>
                  <p className="text-sm font-medium">Profile photo</p>
                  <p className="text-xs text-muted-foreground">Click to upload — you can reframe it before saving</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} disabled /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>

            <div className="space-y-1.5"><Label>Bio</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A short bio for parents and students..." /></div>

            <div className="pt-4 border-t border-border/50 space-y-3">
              <h3 className="eyebrow">Address</h3>
              <Input placeholder="Address line 1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
              <Input placeholder="Address line 2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input placeholder="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
                <Input placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 space-y-3">
              <h3 className="eyebrow">Next of kin</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Name" value={form.next_of_kin_name} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} />
                <Input placeholder="Phone" value={form.next_of_kin_phone} onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })} />
              </div>
              <Input placeholder="Relationship" value={form.next_of_kin_relationship} onChange={(e) => setForm({ ...form, next_of_kin_relationship: e.target.value })} />
            </div>

            <Button onClick={save} className="w-full">Save changes</Button>
          </CardContent>
        </Card>
      </FadeRise>
    </div>
  );
};

export default StaffProfile;
