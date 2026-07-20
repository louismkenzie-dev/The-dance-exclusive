import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: any | null;
  onSaved?: () => void;
}

const CustomerEditDialog = ({ open, onOpenChange, profile, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    full_name: "", email: "", phone: "", secondary_phone: "",
    address_line1: "", address_line2: "", city: "", county: "", postcode: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      secondary_phone: profile.secondary_phone ?? "",
      address_line1: profile.address_line1 ?? "",
      address_line2: profile.address_line2 ?? "",
      city: profile.city ?? "",
      county: profile.county ?? "",
      postcode: profile.postcode ?? "",
    });
  }, [profile, open]);

  const update = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        secondary_phone: form.secondary_phone || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        city: form.city || null,
        county: form.county || null,
        postcode: form.postcode || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Customer updated" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit customer</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input value={form.secondary_phone} onChange={(e) => update("secondary_phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address line 1</Label>
            <Input value={form.address_line1} onChange={(e) => update("address_line1", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Address line 2</Label>
            <Input value={form.address_line2} onChange={(e) => update("address_line2", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>County</Label>
              <Input value={form.county} onChange={(e) => update("county", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={(e) => update("postcode", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditDialog;