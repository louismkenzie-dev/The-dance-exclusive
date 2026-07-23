import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarDays, Clock, Loader2, MapPin, Repeat } from "lucide-react";
import { monthlyPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface CandidateClass {
  id: string;
  name: string;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  class_type: "children" | "adult";
  price_per_session: number | null;
  price_per_term: number | null;
  price_per_month: number | null;
  price_per_year: number | null;
  age_min: number | null;
  age_max: number | null;
  venues: { name: string } | null;
}

interface ChangeClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: {
    id: string;
    class_id: string | null;
    className: string;
    studentName: string | null;
    studentDob: string | null;
    monthly_amount: number;
  } | null;
  onSwitched: () => void;
}

const DAY_ORDER: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

const ageFromDob = (dob: string) =>
  Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

/**
 * Move a rolling monthly membership to a different weekly class. This is the
 * sanctioned way to change day/venue — the membership stays tied to one
 * specific class, the register updates immediately and the subscription
 * re-prices from the next payment.
 */
const ChangeClassDialog = ({ open, onOpenChange, membership, onSwitched }: ChangeClassDialogProps) => {
  const [classes, setClasses] = useState<CandidateClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!open) { setSelectedId(null); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, day_of_week, start_time, end_time, class_type, price_per_session, price_per_term, price_per_month, price_per_year, age_min, age_max, venues(name)")
        .eq("class_type", "children")
        .eq("is_active", true)
        .eq("status", "confirmed")
        .eq("publicly_visible", true)
        .eq("booking_enabled", true)
        .eq("invite_only", false);
      setClasses(((data as unknown as CandidateClass[]) ?? []));
      setLoading(false);
    })();
  }, [open]);

  const candidates = useMemo(() => {
    if (!membership) return [];
    const age = membership.studentDob ? ageFromDob(membership.studentDob) : null;
    return classes
      .filter((c) => c.id !== membership.class_id)
      // Only offer age-appropriate classes when the class sets an age range.
      .filter((c) => age == null || ((c.age_min == null || age >= c.age_min) && (c.age_max == null || age <= c.age_max)))
      .sort((a, b) =>
        (DAY_ORDER[a.day_of_week ?? ""] ?? 7) - (DAY_ORDER[b.day_of_week ?? ""] ?? 7) ||
        (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
        a.name.localeCompare(b.name),
      );
  }, [classes, membership]);

  const confirmSwitch = async () => {
    if (!membership || !selectedId) return;
    setSwitching(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: {
          action: "switch_class",
          membershipId: membership.id,
          newClassId: selectedId,
        },
      });
      // supabase-js hides the function's JSON body behind error.context —
      // surface the server's friendly message instead of the generic one.
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || data?.error) {
        toast.error("Could not change class", { description: message || "Please try again" });
      } else {
        toast.success(`Switched to ${data.newClassName}`, {
          description: `£${Number(data.newMonthlyAmount).toFixed(2)}/month${data.nextPaymentDate ? ` from ${format(new Date(data.nextPaymentDate), "d MMM yyyy")}` : ""} — the register has been updated.`,
        });
        onOpenChange(false);
        onSwitched();
      }
    } catch (e: any) {
      toast.error("Could not change class", { description: e?.message });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!switching) onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" /> Change class
          </DialogTitle>
          <DialogDescription>
            Move {membership?.studentName ? <strong>{membership.studentName}&#39;s</strong> : "this"} membership
            from <strong>{membership?.className}</strong> to a different weekly class. The register updates
            straight away and your monthly payment continues on the new class — this is an ongoing change,
            not a one-week swap.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading classes...</div>
          ) : candidates.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No other suitable classes are open for booking right now.
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {candidates.map((c) => {
                const day = c.day_of_week ? c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1) : null;
                const selected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {day && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> {day}s
                            </span>
                          )}
                          {c.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {c.start_time.slice(0, 5)}
                              {c.end_time ? `–${c.end_time.slice(0, 5)}` : ""}
                            </span>
                          )}
                          {c.venues?.name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {c.venues.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold whitespace-nowrap">
                        £{monthlyPrice(c).toFixed(2)}
                        <span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          Prices shown are the standard monthly rate — your exact price is confirmed when you switch
          (any sibling discount, additional-class rate or the £110 unlimited cap still applies).
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={switching}>
            Keep current class
          </Button>
          <Button onClick={confirmSwitch} disabled={!selectedId || switching}>
            {switching && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirm change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeClassDialog;
