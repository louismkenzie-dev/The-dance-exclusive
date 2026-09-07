import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { monthlyPrice } from "@/lib/pricing";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { OptionRow } from "@/components/booking/OptionRow";
import { OptionRowsSkeleton } from "@/components/booking/PortalSkeletons";
import { formatDay, formatPrice, formatTimeRange } from "@/lib/bookingFormat";

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
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => { if (!switching) onOpenChange(o); }}
      title="Change class"
      description={
        <>
          Move {membership?.studentName ? <span className="font-medium text-foreground">{membership.studentName}'s</span> : "this"} membership
          from <span className="font-medium text-foreground">{membership?.className}</span> to a different weekly class.
          The register updates straight away and your monthly payment continues on the new class — an ongoing change, not a one-week swap.
        </>
      }
      themeClass="portal-ui"
      footer={
        <div className="flex gap-2">
          <Button variant="soft" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={switching}>
            Keep current class
          </Button>
          <Button className="h-12 flex-1 rounded-xl" onClick={confirmSwitch} disabled={!selectedId || switching}>
            {switching && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm change
          </Button>
        </div>
      }
    >
      {loading ? (
        <OptionRowsSkeleton rows={4} />
      ) : candidates.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted-foreground">
          No other suitable classes are open for booking right now.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Choose a class" className="space-y-2">
          {candidates.map((c) => (
            <OptionRow
              key={c.id}
              selected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id)}
              title={c.name}
              meta={[
                c.day_of_week ? formatDay(c.day_of_week, "plural") : null,
                c.start_time ? formatTimeRange(c.start_time, c.end_time) : null,
                c.venues?.name ?? null,
              ].filter(Boolean).join(" · ")}
              trailing={
                <>
                  {formatPrice(monthlyPrice(c))}
                  <span className="text-[13px] font-normal text-muted-foreground">/month</span>
                </>
              }
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        Prices shown are the standard monthly rate — your exact price is confirmed when you switch
        (any sibling discount, additional-class rate or the £110 unlimited cap still applies).
      </p>
    </ResponsiveSheet>
  );
};

export default ChangeClassDialog;
