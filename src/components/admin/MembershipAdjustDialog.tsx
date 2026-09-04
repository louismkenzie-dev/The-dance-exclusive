import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The membership being adjusted — a snapshot of the admin table row. */
export interface AdjustableMembership {
  id: string;
  monthly_amount: number;
  /** Next payment date (always the 5th, ~07:00 UTC) — null once ended. */
  current_period_end: string | null;
  /** Calendar month (1-12) the family doesn't pay; null means August. */
  free_month: number | null;
  className: string;
  studentName: string | null;
  status: string;
}

interface MembershipAdjustment {
  id: string;
  billing_month: string;
  amount: number;
  reason: string | null;
  status: string;
}

interface MonthOption {
  /** First day of the month, "YYYY-MM-01" — what the server expects. */
  key: string;
  /** Calendar month 1-12, for the free-month check. */
  month: number;
  label: string;
}

interface MembershipAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: AdjustableMembership | null;
  /** Called after an adjustment is added or removed so the caller can refetch. */
  onSaved?: () => void;
}

/** The next payment month plus this many after it. */
const MONTHS_OFFERED = 6;

/** Default free month when a membership doesn't say (matches the parent portal). */
const DEFAULT_FREE_MONTH = 8;

const money = (n: number) => `£${Math.abs(n).toFixed(2)}`;

/** "−£7.00" for money off, "+£5.00" for extra. */
const signedMoney = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;

/** "February 2027" from a "YYYY-MM-DD" date string — parsed by parts so the
 *  browser's timezone can't shift it into the previous month. */
const monthName = (ymd: string, pattern = "MMMM yyyy") => {
  const [y, m] = ymd.split("-").map(Number);
  return format(new Date(y, m - 1, 1), pattern);
};

/** The payment months the admin can adjust: the month containing the next
 *  payment (or next month when there's no date yet) and the five after it.
 *  Payments land at ~07:00 UTC on the 5th, so the UTC month is the right one. */
const buildMonthOptions = (currentPeriodEnd: string | null): MonthOption[] => {
  const next = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const base = next
    ? new Date(next.getUTCFullYear(), next.getUTCMonth(), 1)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return Array.from({ length: MONTHS_OFFERED }, (_, i) => {
    const first = new Date(base.getFullYear(), base.getMonth() + i, 1);
    // The first option is the real next payment date; later ones are the usual 5th.
    const day = i === 0 && next ? next.getUTCDate() : 5;
    return {
      key: `${format(first, "yyyy-MM")}-01`,
      month: first.getMonth() + 1,
      label: `${format(new Date(first.getFullYear(), first.getMonth(), day), "d MMMM yyyy")} payment`,
    };
  });
};

/** Pull the server's friendly message out of a functions.invoke result. */
const readFunctionError = async (
  data: { error?: string } | null | undefined,
  error: unknown,
): Promise<string | undefined> => {
  let message: string | undefined = data?.error || (error as { message?: string } | null)?.message;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) message = body.error;
    } catch { /* keep generic */ }
  }
  return message;
};

/**
 * Take money off (or add extra to) ONE month's payment of a monthly
 * membership. The server puts the difference on that month's Stripe invoice
 * so the card really is charged less; the months after carry on as normal.
 */
const MembershipAdjustDialog = ({ open, onOpenChange, membership, onSaved }: MembershipAdjustDialogProps) => {
  const { toast } = useToast();
  const [monthKey, setMonthKey] = useState("");
  const [direction, setDirection] = useState<"off" | "extra">("off");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [adjustments, setAdjustments] = useState<MembershipAdjustment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // An 'applied' adjustment the admin asked to remove — needs a confirm first.
  const [confirmRemove, setConfirmRemove] = useState<MembershipAdjustment | null>(null);

  const busy = saving || !!removingId;
  const monthlyAmount = Number(membership?.monthly_amount ?? 0);
  const freeMonth = membership?.free_month ?? DEFAULT_FREE_MONTH;

  const loadAdjustments = useCallback(async () => {
    if (!membership) return;
    setLoadingList(true);
    const { data, error } = await supabase
      .from("membership_adjustments")
      .select("id, billing_month, amount, reason, status")
      .eq("membership_id", membership.id)
      .neq("status", "removed")
      .order("billing_month");
    setLoadingList(false);
    if (error) {
      toast({ title: "Couldn't load existing adjustments", description: error.message, variant: "destructive" });
      return;
    }
    setAdjustments((data ?? []).map((a) => ({ ...a, amount: Number(a.amount) })));
  }, [membership, toast]);

  // Fresh form + list every time the dialog opens for a membership.
  useEffect(() => {
    if (!open) return;
    setMonthKey("");
    setDirection("off");
    setAmount("");
    setReason("");
    setConfirmRemove(null);
    loadAdjustments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, membership?.id]);

  const options = useMemo(() => {
    const adjustedMonths = new Set(adjustments.map((a) => a.billing_month.slice(0, 7)));
    return buildMonthOptions(membership?.current_period_end ?? null).map((o) => ({
      ...o,
      isFree: o.month === freeMonth,
      alreadyAdjusted: adjustedMonths.has(o.key.slice(0, 7)),
    }));
  }, [membership?.current_period_end, freeMonth, adjustments]);

  // Default to the first month that can actually be adjusted.
  useEffect(() => {
    const current = options.find((o) => o.key === monthKey);
    if (current && !current.isFree && !current.alreadyAdjusted) return;
    setMonthKey(options.find((o) => !o.isFree && !o.alreadyAdjusted)?.key ?? "");
  }, [options, monthKey]);

  const selected = options.find((o) => o.key === monthKey) ?? null;
  const pounds = Number(amount);
  const amountValid = Number.isFinite(pounds) && pounds > 0;
  const signedAmount = direction === "off" ? -pounds : pounds;
  const resultingPayment = Math.max(0, monthlyAmount + signedAmount);

  const save = async () => {
    if (!membership || !selected) return;
    if (!amountValid) {
      toast({ title: "Enter an amount", description: "The amount must be more than £0.", variant: "destructive" });
      return;
    }
    if (direction === "off" && pounds > monthlyAmount + 0.005) {
      toast({
        title: "That's more than the monthly amount",
        description: `The most you can take off this membership is ${money(monthlyAmount)} — the full month.`,
        variant: "destructive",
      });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Add a reason", description: "A short note on why — it's kept with the payment record.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: {
          action: "adjust",
          membershipId: membership.id,
          billingMonth: selected.key,
          amount: Math.round(signedAmount * 100) / 100,
          reason: reason.trim(),
        },
      });
      const message = await readFunctionError(data, error);
      if (error || !data?.success) {
        toast({ title: "Couldn't save the adjustment", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: "Adjustment saved",
        description: `${monthName(selected.key, "MMMM")}'s payment will be ${money(resultingPayment)} instead of ${money(monthlyAmount)}.`,
      });
      setAmount("");
      setReason("");
      setDirection("off");
      await loadAdjustments();
      onSaved?.();
    } catch (e) {
      toast({ title: "Couldn't save the adjustment", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (adj: MembershipAdjustment) => {
    if (!membership) return;
    setRemovingId(adj.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: { action: "remove_adjustment", membershipId: membership.id, adjustmentId: adj.id },
      });
      const message = await readFunctionError(data, error);
      if (error || !data?.success) {
        toast({ title: "Couldn't remove the adjustment", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: "Adjustment removed",
        description: `${monthName(adj.billing_month, "MMMM")}'s payment goes back to the usual ${money(monthlyAmount)}.`,
      });
      setConfirmRemove(null);
      await loadAdjustments();
      onSaved?.();
    } catch (e) {
      toast({ title: "Couldn't remove the adjustment", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const onRemoveClick = (adj: MembershipAdjustment) => {
    if (adj.status === "applied") setConfirmRemove(adj);
    else remove(adj);
  };

  const who = membership?.studentName ? `${membership.studentName} — ${membership.className}` : membership?.className;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Adjust a payment
            </DialogTitle>
            <DialogDescription>
              {who && <><strong>{who}</strong> · {money(monthlyAmount)}/month. </>}
              Takes the amount off that month&apos;s payment only. The usual amount carries on the month after.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {membership?.status === "past_due" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This family&apos;s last payment didn&apos;t go through. The adjustment applies to the
                payment for the month you pick, whenever Stripe manages to take it.
              </p>
            )}

            <div className="grid gap-2">
              <Label>Which payment</Label>
              <Select value={monthKey} onValueChange={setMonthKey} disabled={busy}>
                <SelectTrigger><SelectValue placeholder="Choose a month..." /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.key} value={o.key} disabled={o.isFree || o.alreadyAdjusted}>
                      {o.label}
                      {o.isFree && " (free month — no payment taken)"}
                      {!o.isFree && o.alreadyAdjusted && " (already adjusted — remove it below first)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{direction === "off" ? "Amount off (£)" : "Extra amount (£)"}</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setDirection(direction === "off" ? "extra" : "off")}
                  disabled={busy}
                >
                  {direction === "off" ? "Need to add extra instead?" : "Take money off instead"}
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={busy}
                />
                {direction === "off" && monthlyAmount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => setAmount(monthlyAmount.toFixed(2))}
                  >
                    One month free ({money(monthlyAmount)})
                  </Button>
                )}
              </div>
              {amountValid && selected && (
                <p className="text-xs text-muted-foreground">
                  {monthName(selected.key, "MMMM")}&apos;s payment becomes{" "}
                  <span className="font-medium text-foreground">{money(resultingPayment)}</span> instead of {money(monthlyAmount)}.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Credit for the class cancelled on 12 January"
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">Shows on the family&apos;s invoice, so keep it friendly.</p>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adjustments on this membership</p>
              {loadingList ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : adjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{monthName(a.billing_month)}:</span>{" "}
                        <span className={a.amount < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                          {signedMoney(a.amount)}
                        </span>
                        {a.reason && <span className="text-muted-foreground"> — {a.reason}</span>}
                        <Badge
                          variant="outline"
                          className={`ml-2 align-middle text-[10px] ${a.status === "applied" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""}`}
                        >
                          {a.status === "applied" ? "Applied" : "Pending"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs shrink-0"
                        disabled={busy}
                        onClick={() => onRemoveClick(a)}
                      >
                        {removingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Remove"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Pending = waiting for that month&apos;s payment. Applied = already passed to Stripe for the next payment.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
            <Button onClick={save} disabled={busy || !selected || !amountValid || !reason.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {amountValid
                ? direction === "off" ? `Take ${money(pounds)} off` : `Add ${money(pounds)}`
                : "Save adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => { if (!o && !removingId) setConfirmRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this adjustment?</AlertDialogTitle>
            <AlertDialogDescription>
              This has already been passed to Stripe for the next payment. Remove it?
              {confirmRemove && (
                <> {monthName(confirmRemove.billing_month, "MMMM")}&apos;s payment would go back to the usual {money(monthlyAmount)}.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingId}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!removingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (confirmRemove) remove(confirmRemove); }}
            >
              {removingId ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MembershipAdjustDialog;
