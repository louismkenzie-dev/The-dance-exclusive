import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { planPause } from "@/lib/membershipPause";

export interface PausableMembership {
  membershipId: string;
  subscriptionId: string | null;
  childName: string;
  className: string;
  amount: number;
  status: string;
  nextCharge: string | null;
  pausedUntil: string | null;
  pauseReason: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyName: string;
  memberships: PausableMembership[];
  onDone: () => void;
}

const money = (n: number) => `£${n.toFixed(2)}`;
const day = (iso: string) => format(parseISO(iso), "d MMMM");
const MONTH_CHOICES = [1, 2, 3];

/**
 * Pause a family's monthly payments for an agreed number of months.
 *
 * Amie: "Brooke George ... she's had a seizure, bless her, and they're on
 * unlimited. I said I'll pause it for October because she can't walk at the
 * moment." A pause is not a cancellation: the family keeps every class and
 * its price, and simply isn't charged. Stripe voids those months' invoices,
 * so nothing is owed when they come back.
 *
 * It works on the family's whole subscription, because that is how the money
 * actually moves — Brooke's £110 Unlimited is seven memberships on one
 * subscription, and pausing one would still take £83.65 from a family who had
 * been told they were paying nothing.
 */
const MembershipPauseDialog = ({ open, onOpenChange, familyName, memberships, onDone }: Props) => {
  const { toast } = useToast();
  const [months, setMonths] = useState(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMonths(1);
    setReason("");
  }, [open]);

  /** The money moves per subscription, so that is what gets paused. */
  const subscriptions = useMemo(() => {
    const bySub = new Map<string, PausableMembership[]>();
    for (const m of memberships) {
      if (!m.subscriptionId) continue;
      if (!["active", "past_due", "paused"].includes(m.status)) continue;
      bySub.set(m.subscriptionId, [...(bySub.get(m.subscriptionId) ?? []), m]);
    }
    return [...bySub.entries()].map(([subscriptionId, rows]) => {
      // Every row on one subscription shares its billing date.
      const nextCharge = rows.map((r) => r.nextCharge).filter(Boolean).sort()[0] ?? null;
      return {
        subscriptionId,
        rows,
        monthlyTotal: rows.reduce((sum, r) => sum + r.amount, 0),
        nextCharge,
        pausedUntil: rows.map((r) => r.pausedUntil).filter(Boolean).sort().pop() ?? null,
        pauseReason: rows.find((r) => r.pauseReason)?.pauseReason ?? null,
        leadMembershipId: rows[0].membershipId,
      };
    });
  }, [memberships]);

  const isPaused = subscriptions.some((s) => s.pausedUntil);
  const totalMonthly = subscriptions.reduce((sum, s) => sum + s.monthlyTotal, 0);
  const placeCount = subscriptions.reduce((sum, s) => sum + s.rows.length, 0);

  /** What each subscription's pause would look like, for the preview. */
  const previews = subscriptions.map((s) => ({
    ...s,
    plan: s.nextCharge ? planPause(new Date(s.nextCharge), months, s.monthlyTotal) : null,
  }));
  const skippedTotal = previews.reduce((sum, p) => sum + (p.plan?.skippedTotal ?? 0), 0);
  const nothingToPause = previews.every((p) => !p.plan);

  const run = async (action: "pause" | "resume") => {
    if (action === "pause" && !reason.trim()) {
      toast({ title: "Add a short reason", description: "It's the record of what was agreed with the family.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const failures: string[] = [];
    let touched = 0;
    for (const s of subscriptions) {
      const { data, error } = await supabase.functions.invoke("manage-membership", {
        body: {
          action,
          membershipId: s.leadMembershipId,
          ...(action === "pause" ? { months, reason: reason.trim() } : {}),
        },
      });
      let message = (data as any)?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.error) message = b.error;
        } catch { /* keep generic */ }
      }
      if (error || !(data as any)?.success) failures.push(message || "Something went wrong");
      else touched += Number((data as any).memberships ?? s.rows.length);
    }
    setSaving(false);

    if (failures.length > 0) {
      toast({ title: action === "pause" ? "Couldn't pause" : "Couldn't restart", description: failures[0], variant: "destructive" });
      if (touched === 0) return;
    }
    if (touched > 0) {
      toast({
        title: action === "pause" ? `Payments paused for ${familyName}` : `Payments restarted for ${familyName}`,
        description: action === "pause"
          ? `${touched} membership${touched === 1 ? "" : "s"} · ${money(skippedTotal)} won't be taken.`
          : `${touched} membership${touched === 1 ? "" : "s"} back to normal billing.`,
      });
      onDone();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-dialog flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{isPaused ? `${familyName} — payments paused` : `Pause payments for ${familyName}`}</DialogTitle>
          <DialogDescription>
            {isPaused
              ? "They're not being charged. You can restart billing early if they come back sooner."
              : "They keep every class and their price — they just aren't charged. Nothing is owed afterwards."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-base font-semibold tabular-nums">{money(totalMonthly)}</p>
              <p className="text-[11px] text-muted-foreground">A month, across {placeCount} class{placeCount === 1 ? "" : "es"}</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-base font-semibold tabular-nums">
                {isPaused ? day(subscriptions.find((s) => s.pausedUntil)!.pausedUntil!) : money(skippedTotal)}
              </p>
              <p className="text-[11px] text-muted-foreground">{isPaused ? "Billing restarts" : "Won't be taken"}</p>
            </div>
          </div>

          {isPaused ? (
            <div className="space-y-2">
              {subscriptions.filter((s) => s.pausedUntil).map((s) => (
                <div key={s.subscriptionId} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Paused until {day(s.pausedUntil!)}</p>
                  {s.pauseReason && <p className="mt-0.5 text-xs text-muted-foreground">{s.pauseReason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.rows.length} membership{s.rows.length === 1 ? "" : "s"} · {money(s.monthlyTotal)}/mo · resumes automatically
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>How many payments to skip</Label>
                <div className="flex overflow-hidden rounded-md border border-border">
                  {MONTH_CHOICES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMonths(n)}
                      className={cn(
                        "flex-1 px-3 py-2 text-sm transition-colors",
                        months === n ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {n} month{n === 1 ? "" : "s"}
                    </button>
                  ))}
                </div>
              </div>

              {/* The whole point of the screen: exactly which payments will
                  not be taken, and the day the family starts paying again. */}
              <div className="space-y-2">
                {previews.map((p) => (
                  <div key={p.subscriptionId} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {p.plan ? (
                      <>
                        <p>
                          <span className="font-medium">
                            {p.plan.skipped.map(day).join(", ")}
                          </span>{" "}
                          — {money(p.monthlyTotal)} {p.plan.skipped.length === 1 ? "won't be taken" : "each, not taken"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Billing starts again on <strong className="text-foreground">{day(p.plan.restartsOn)}</strong>,
                          at the usual {money(p.monthlyTotal)}. Covers {p.rows.length} class{p.rows.length === 1 ? "" : "es"}:{" "}
                          {p.rows.map((r) => r.className).join(", ")}.
                        </p>
                      </>
                    ) : (
                      <p className="text-destructive">
                        No upcoming payment date on this membership, so it can't be paused from here.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pause-reason">Why (for your records)</Label>
                <Textarea
                  id="pause-reason"
                  rows={2}
                  placeholder="e.g. Brooke has had a seizure and can't walk at the moment — agreed to pause October."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only the studio sees this. The family isn't emailed automatically — tell them yourself,
                  so it comes from you.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
          {isPaused ? (
            <Button onClick={() => run("resume")} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Restarting…</>
                : <><PlayCircle className="mr-1.5 h-4 w-4" /> Start billing again now</>}
            </Button>
          ) : (
            <Button onClick={() => run("pause")} disabled={saving || nothingToPause}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Pausing…</>
                : <><PauseCircle className="mr-1.5 h-4 w-4" /> Pause · {money(skippedTotal)} not taken</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MembershipPauseDialog;
