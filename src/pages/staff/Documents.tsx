import { useStaffMember } from "@/hooks/useStaffMember";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FadeRise } from "@/components/motion";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, X, Shield } from "lucide-react";
import { useState } from "react";

const StaffDocuments = () => {
  const { staff, refresh } = useStaffMember();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [dbsNumber, setDbsNumber] = useState(staff?.dbs_number || "");
  const [dbsDate, setDbsDate] = useState(staff?.dbs_issue_date || "");

  if (!staff) return <div className="p-6 md:p-8 text-muted-foreground">Loading...</div>;

  const upload = async (field: string, file: File) => {
    setUploading(field);
    const ext = file.name.split(".").pop();
    const path = `${field}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("staff-documents").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("staff").update({ [field]: path }).eq("id", staff.id);
      toast({ title: "Uploaded" });
      void refresh();
    }
    setUploading(null);
  };

  const remove = async (field: string) => {
    await supabase.from("staff").update({ [field]: null }).eq("id", staff.id);
    void refresh();
  };

  const saveDbsDetails = async () => {
    await supabase.from("staff").update({ dbs_number: dbsNumber, dbs_issue_date: dbsDate || null }).eq("id", staff.id);
    toast({ title: "Saved" });
    void refresh();
  };

  const FileSlot = ({ field, label }: { field: string; label: string }) => {
    const value = (staff as any)[field] as string | null;
    return (
      <div className="space-y-2">
        <Label className="text-xs">{label}</Label>
        {value ? (
          <div className="flex items-center gap-2 rounded-2xl bg-success/8 p-3 text-xs">
            <FileText className="w-4 h-4 text-success shrink-0" />
            <span className="truncate flex-1">{value.split("/").pop()}</span>
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => remove(field)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-3 cursor-pointer hover:bg-secondary/60 transition-colors">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{uploading === field ? "Uploading..." : "Upload"}</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(field, e.target.files[0])} />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <FadeRise>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">My documents</h1>
        <p className="text-muted-foreground mt-1">DBS certificate &amp; public liability insurance</p>
      </FadeRise>

      <FadeRise delay={80}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="font-display font-bold">DBS certificate</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileSlot field="dbs_certificate_front" label="Certificate (front)" />
              <FileSlot field="dbs_certificate_back" label="Certificate (back)" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">DBS number</Label>
                <Input value={dbsNumber} onChange={(e) => setDbsNumber(e.target.value)} placeholder="e.g. 001234567890" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Issue date</Label>
                <Input type="date" value={dbsDate} onChange={(e) => setDbsDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={saveDbsDetails} size="sm">Save DBS details</Button>
          </CardContent>
        </Card>
      </FadeRise>

      <FadeRise delay={160}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="font-display font-bold">Public liability insurance</h2>
            </div>
            <FileSlot field="pli_certificate" label="PLI certificate" />
            {staff.pli_cover_level && <p className="text-xs text-muted-foreground">Cover level: <strong className="text-foreground">£{staff.pli_cover_level.replace("m", " million")}</strong> (set by admin)</p>}
          </CardContent>
        </Card>
      </FadeRise>
    </div>
  );
};

export default StaffDocuments;
