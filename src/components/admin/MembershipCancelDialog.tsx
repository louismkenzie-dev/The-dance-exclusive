import { useEffect, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CancellableMembership {
  membershipId: string;
  childName: string;
  className: string;
  amount: number;
  status: string;
  /** ISO — the next billing date, which is when a final payment would be taken. */
  nextCharge: string | null;
  pausedUntil: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: CancellableMembership | null;
  onDone: () => void;
}

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const pretty = (iso: string | null) => (iso ? format(parseISO(iso), "d MMM yyyy") : null);

type Mode = "notice" | "now";

/**
 * Ending a monthly membership from admin.
 *
 * Until now this could only be done by the parent, in their own account, which meant Amie had no
 * way to end a direct debit at all — and a leaver was instead being "paused", which silently
 * resumes and charges them again months later.
 *
 * Two routes, and the dialog spells out the money either way, because they differ by a whole
 * month's fee and that is not a thing to discover afterwards.
 */
const MembershipCancelDialog = ({ open, onOpenChange, membership, onDone }: Props) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("notice");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMode("notice");
  }, [open, membership?.membershipId]);

  if (!membership) return null;

  const finalPayment = pretty(membership.nextCharge);
  const endsOn = membership.nextCharge
    ? format(addMonths(parseISO(membership.nextCharge), 1), "d MMM yyyy")
    : null;
  // A paused membership has its invoices voided, so the "final payment" would be voided too.
  const isPaused = membership.status === "paused" && !!membership.pausedUntil;

  const submit = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: {
          action: mode === "now" ? "cancel_now" : "cancel",
          membershipId: membership.membershipId,
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }
      toast({
        title: mode === "now" ? "Membership ended" : "Cancellation scheduled",
        description:
          mode === "now"
            ? `${membership.childName} has been taken off ${membership.className}. Nothing further will be taken.`
            : `Final payment ${finalPayment ?? "on the next billing date"}, ending ${endsOn ?? "a month later"}.`,
      });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast({
        title: "Couldn't cancel",
        description: e instanceof Error ? e.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const option = (value: Mode, title: string, detail: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        mode === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 h-4 w-4 flex-none rounded-full border-2",
            mode === value ? "border-primary bg-primary" : "border-muted-foreground/40",
          )}
        />
        <div>
          <div className="font-medium">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel monthly payment</DialogTitle>
          <DialogDescription>
            {membership.childName} · {membership.className} · {money(membership.amount)}/month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {option(
            "notice",
            "One month's notice",
            finalPayment
              ? `A final payment of ${money(membership.amount)} on ${finalPayment}, then it ends ${endsOn}. This is the standard terms.`
              : "A final payment on the next billing date, then it ends a month later. This is the standard terms.",
          )}
          {option(
            "now",
            "End now — take nothing further",
            "For a family who has already left, or where you're waiving the notice. The place is given up today and no further payment is taken.",
          )}
        </div>

        {isPaused && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            This membership is paused until {pretty(membership.pausedUntil)}, so nothing is being
            taken right now — but a pause <span className="font-medium">restarts by itself</span>.
            If the family has left, end it now rather than leaving it paused.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Back
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            {mode === "now" ? "End it now" : "Schedule cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MembershipCancelDialog;
