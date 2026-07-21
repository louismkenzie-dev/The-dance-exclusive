import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users } from "lucide-react";

interface StaffRow {
  id: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string;
  staffList: StaffRow[];
  onSaved: () => void;
}

/**
 * Quick staff assignment for an existing class — no need to walk the full
 * class wizard (which requires terms/sessions) just to set instructors.
 * Writes class_instructors with exactly one "main" instructor.
 */
export const AssignStaffDialog = ({ open, onOpenChange, classId, className, staffList, onSaved }: Props) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [mainId, setMainId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !classId) return;
    setLoading(true);
    supabase
      .from("class_instructors")
      .select("staff_id, instructor_role")
      .eq("class_id", classId)
      .then(({ data }) => {
        const rows: { staff_id: string; instructor_role: string }[] = data ?? [];
        setSelected(rows.map((r) => r.staff_id));
        setMainId(rows.find((r) => r.instructor_role === "main")?.staff_id || rows[0]?.staff_id || "");
        setLoading(false);
      });
  }, [open, classId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(mainId)) setMainId(next[0] || "");
      if (next.length === 1) setMainId(next[0]);
      return next;
    });
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaving(true);
    const resolvedMain = selected.includes(mainId) ? mainId : selected[0];

    const { error: delError } = await supabase.from("class_instructors").delete().eq("class_id", classId);
    if (delError) {
      toast({ title: "Couldn't update staff", description: delError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (selected.length > 0) {
      const { error } = await supabase.from("class_instructors").insert(
        selected.map((sid) => ({
          class_id: classId,
          staff_id: sid,
          instructor_role: sid === resolvedMain ? "main" : "assistant",
        })),
      );
      if (error) {
        toast({ title: "Couldn't update staff", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      // Keep the legacy single-instructor column in sync for older queries.
      await supabase.from("classes").update({ instructor_id: resolvedMain }).eq("id", classId);
    } else {
      await supabase.from("classes").update({ instructor_id: null }).eq("id", classId);
    }
    setSaving(false);
    toast({ title: "Staff updated", description: selected.length === 0 ? "No instructors assigned." : undefined });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <Users className="w-5 h-5" />
            </span>
            Assign staff
          </DialogTitle>
          <DialogDescription>{className}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No active staff members yet. Add staff in Admin → Staff first.
          </p>
        ) : (
          <div className="space-y-2">
            {staffList.map((s) => {
              const isSelected = selected.includes(s.id);
              const isMain = isSelected && (selected.includes(mainId) ? mainId : selected[0]) === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                    isSelected ? "bg-primary/5 ring-1 ring-primary/30" : "bg-secondary/40 hover:bg-secondary/60"
                  }`}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(s.id)} />
                  <span className="flex-1 text-sm font-medium">{s.full_name}</span>
                  {isSelected && (
                    isMain ? (
                      <Badge className="text-[10px]">Main</Badge>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setMainId(s.id)}>
                        Make main
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
