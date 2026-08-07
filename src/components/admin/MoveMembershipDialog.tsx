import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Repeat } from "lucide-react";

export interface MoveMembershipTarget {
  membershipId: string;
  parentName: string;
  childName: string;
  className: string;
  classId: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  day_of_week: string | null;
  start_time: string | null;
  venues: { name: string } | null;
}

interface MoveMembershipDialogProps {
  target: MoveMembershipTarget | null;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}

/** Class4kids-style transfer for monthly memberships: Amie picks the new
 *  class and the server does the rest — re-prices the family's subscription
 *  (additional-class rate, sibling discount, £110 cap), moves the standing
 *  booking so registers update immediately, and emails the parent. */
const MoveMembershipDialog = ({ target, onOpenChange, onMoved }: MoveMembershipDialogProps) => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [newClassId, setNewClassId] = useState("");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setNewClassId("");
    supabase
      .from("classes")
      .select("id, name, day_of_week, start_time, venues:venue_id(name)")
      .eq("class_type", "children")
      .eq("is_active", true)
      .eq("status", "confirmed")
      .order("name")
      .then(({ data }) => setClasses((data as unknown as ClassOption[]) ?? []));
  }, [target]);

  const options = useMemo(
    () => classes.filter((c) => c.id !== target?.classId),
    [classes, target],
  );

  const label = (c: ClassOption) => {
    const day = c.day_of_week ? c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1) : null;
    const bits = [day, c.start_time?.slice(0, 5), c.venues?.name].filter(Boolean).join(" · ");
    return bits ? `${c.name} — ${bits}` : c.name;
  };

  const move = async () => {
    if (!target || !newClassId) return;
    setMoving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: { action: "switch_class", membershipId: target.membershipId, newClassId },
      });
      if (error || data?.error) {
        toast({ title: "Couldn't move the membership", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const cls = classes.find((c) => c.id === newClassId);
        toast({
          title: "Membership moved",
          description: `${target.childName} is now on ${cls?.name ?? "the new class"} — the register is updated, the subscription is re-priced and the parent has been emailed.`,
        });
        onOpenChange(false);
        onMoved();
      }
    } catch (e: any) {
      toast({ title: "Couldn't move the membership", description: e?.message, variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!moving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" /> Move membership
          </DialogTitle>
          <DialogDescription>
            Move <strong>{target?.childName}</strong>&apos;s membership ({target?.parentName}) from{" "}
            <strong>{target?.className}</strong> to another weekly class. The family&apos;s monthly
            amount is re-priced with the usual rules and the parent gets a confirmation email — the
            register updates straight away.
          </DialogDescription>
        </DialogHeader>

        <Select value={newClassId} onValueChange={setNewClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose the new class..." />
          </SelectTrigger>
          <SelectContent className="max-w-[90vw]">
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id}>{label(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={moving}>Cancel</Button>
          <Button onClick={move} disabled={!newClassId || moving}>
            {moving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Move membership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveMembershipDialog;
