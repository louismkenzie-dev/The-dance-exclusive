import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2, Mail, Ticket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Method = "card" | "credit" | "none";

interface Line {
  id: string;
  kind: "booking" | "membership";
  plan: string;
  student: string | null;
  paid: number;
  total: number;
  left: number;
  suggested: number;
  via: "card" | "pass" | "none";
  note?: string;
}

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  students: string[];
  bookingIds: string[];
  paid: number;
  owed: number;
  canCard: boolean;
  suggestedMethod: Method;
  lines: Line[];
  refund?: { method: Method; amount: number; ok: boolean; detail: string };
  credit?: { code: string; amount: number; expires: string };
  emailed?: boolean;
  reason?: string;
}

interface Preview {
  className: string;
  venueName: string | null;
  families: Family[];
  bookingCount: number;
  pastBookings: number;
  pendingInvites: number;
  futureSessions: number;
  totalPaid: number;
  totalOwed: number;
  memberships: number;
}

interface Done {
  cancelledBookings: number;
  endedMemberships: number;
  refundedTotal: number;
  creditTotal: number;
  emailed: number;
  families: Family[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string;
  /** Called once a class has actually been taken down. */
  onDone?: () => void;
}

const money = (n: number) => `£${n.toFixed(2)}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const PLAN_LABEL: Record<string, string> = {
  trial: "trial",
  session: "pay as you go",
  pass: "class pass",
  term: "termly",
  yearly: "yearly",
  monthly: "monthly membership",
};

interface Choice {
  method: Method;
  /** Pounds, as typed — kept as text so a half-typed "12." doesn't jump. */
  amount: string;
}

/**
 * Take a class down without losing the people who were on it, and settle up
 * with each family from the same screen.
 *
 * The old route was Delete, which cascaded: the bookings went, and with them
 * every parent's name and email. Amie found that out at 8pm with a
 * cancellation to send and nobody to send it to. This cancels the places and
 * keeps them, ends any monthly memberships in Stripe, works out what each
 * family is owed for the classes that won't now happen, and lets Amie choose
 * per family whether that goes back to their card or onto their account as
 * credit — no Stripe dashboard required.
 */
const CancelClassDialog = ({ open, onOpenChange, classId, className, onDone }: Props) => {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [done, setDone] = useState<Done | null>(null);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setPreview(null);
    setDone(null);
    setChoices({});
    const { data, error } = await supabase.functions.invoke("cancel-class", {
      body: { classId, preview: true },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Couldn't check who's on this class",
        description: (data as any)?.error || error?.message,
        variant: "destructive",
      });
      return;
    }
    const p = data as Preview;
    setPreview(p);
    const initial: Record<string, Choice> = {};
    for (const f of p.families) {
      initial[f.parentId] = { method: f.suggestedMethod, amount: f.owed.toFixed(2) };
    }
    setChoices(initial);
  }, [classId, toast]);

  useEffect(() => {
    if (!open) return;
    setMessage(
      `We are unfortunately writing to let you know that, due to low numbers, we have made the difficult decision to cancel ${className}.\n\n` +
        `We are incredibly grateful for your support and for everyone who signed up and gave our classes a chance.\n\n` +
        `We are really sorry for any disappointment this may cause, and we hope to see you and your dancers at one of our other classes in the future.\n\n` +
        `Amie\nThe Dance Exclusive`,
    );
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  const setChoice = (parentId: string, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [parentId]: { ...prev[parentId], ...patch } }));

  const amountOf = (parentId: string) => {
    const n = Number(choices[parentId]?.amount);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };

  const families = preview?.families ?? [];
  const reachable = families.filter((f) => f.email).length;
  const toCard = families.reduce((s, f) => s + (choices[f.parentId]?.method === "card" ? amountOf(f.parentId) : 0), 0);
  const toCredit = families.reduce((s, f) => s + (choices[f.parentId]?.method === "credit" ? amountOf(f.parentId) : 0), 0);
  const creditWithoutEmail = families.some((f) => choices[f.parentId]?.method === "credit" && !f.email && amountOf(f.parentId) > 0);

  const confirm = async () => {
    if (!classId || !preview) return;
    if (!message.trim()) {
      toast({ title: "Write the message parents will get", variant: "destructive" });
      return;
    }
    if (creditWithoutEmail) {
      toast({
        title: "Credit needs an email address",
        description: "A credit code is locked to the family's email. Pick card or nothing for anyone without one.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const refunds: Record<string, { method: Method; amount: number }> = {};
    for (const f of families) {
      refunds[f.parentId] = { method: choices[f.parentId]?.method ?? f.suggestedMethod, amount: amountOf(f.parentId) };
    }
    const { data, error } = await supabase.functions.invoke("cancel-class", {
      body: { classId, message: message.trim(), notify: true, refunds },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Couldn't cancel the class",
        description: (data as any)?.error || error?.message,
        variant: "destructive",
      });
      return;
    }
    const res = data as Done;
    setDone(res);
    toast({
      title: `${preview.className} cancelled`,
      description:
        `${res.cancelledBookings} ${plural(res.cancelledBookings, "booking", "bookings")} cancelled and kept · ` +
        `${money(res.refundedTotal)} refunded · ${money(res.creditTotal)} credit · ` +
        `${res.emailed} ${plural(res.emailed, "family", "families")} emailed.`,
    });
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-xl max-h-dialog flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border pl-6 pr-14 pb-4 pt-6">
          <DialogTitle>{done ? "Class cancelled" : `Cancel ${className}?`}</DialogTitle>
          <DialogDescription>
            {done
              ? "Everyone's place has been cancelled and kept on record."
              : "The class stops being sold and comes off the timetable. Nobody is deleted, and each family is settled from here."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking who's on this class and what they've paid…
            </p>
          )}

          {done && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Refunded to cards", value: money(done.refundedTotal) },
                  { label: "Studio credit", value: money(done.creditTotal) },
                  { label: "Memberships ended", value: String(done.endedMemberships) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border p-2.5">
                    <p className="text-base font-semibold tabular-nums">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {done.families.map((f) => (
                <div key={f.parentId} className="space-y-1 rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{f.parentName ?? "Parent"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.students.join(", ") || "—"}{f.email ? ` · ${f.email}` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-xs", f.emailed ? "text-[hsl(var(--success-strong))]" : "text-destructive")}>
                      {f.emailed ? "Emailed" : f.reason ?? "Not emailed"}
                    </span>
                  </div>
                  {f.refund && (
                    <p className={cn("text-xs", f.refund.ok ? "text-muted-foreground" : "font-medium text-destructive")}>
                      {f.refund.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {preview && !done && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Families", value: String(families.length) },
                  { label: "Paid for this class", value: money(preview.totalPaid) },
                  { label: "Owed back, pro rata", value: money(preview.totalOwed) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border p-2.5">
                    <p className="text-base font-semibold tabular-nums">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {families.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Who will be told, and how they're settled
                  </p>
                  <div className="space-y-2">
                    {families.map((f) => {
                      const choice = choices[f.parentId] ?? { method: f.suggestedMethod, amount: f.owed.toFixed(2) };
                      return (
                        <div key={f.parentId} className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                          <p className="text-sm font-medium">
                            {f.parentName ?? "Parent"}
                            <span className="font-normal text-muted-foreground">
                              {f.students.length > 0 && ` · ${f.students.join(", ")}`}
                            </span>
                          </p>
                          {/* Its own line, because "no email on file" is the one
                              thing here Amie has to act on, and it was the first
                              thing to get cut off when it shared a line. */}
                          <p className={f.email ? "truncate text-muted-foreground" : "font-medium text-destructive"}>
                            {f.email ?? "No email on file — you'll need to tell them another way"}
                          </p>

                          <ul className="mt-2 space-y-0.5 text-muted-foreground">
                            {f.lines.map((l) => (
                              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <span>
                                  {l.student ? `${l.student} · ` : ""}{PLAN_LABEL[l.plan] ?? l.plan}
                                  {l.total > 0 && ` · ${l.left} of ${l.total} ${plural(l.total, "class", "classes")} still to come`}
                                  {l.note && <span className="italic"> · {l.note}</span>}
                                </span>
                                <span className="tabular-nums">
                                  {l.paid > 0 ? `paid ${money(l.paid)}` : "nothing paid"}
                                  {l.suggested > 0 && <strong className="text-foreground"> → {money(l.suggested)}</strong>}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {f.owed > 0 || choice.method !== "none" ? (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <div className="flex overflow-hidden rounded-md border border-border">
                                {([
                                  ["card", "Refund to card", CreditCard, f.canCard, "No card payment left to refund"],
                                  ["credit", "Studio credit", Ticket, !!f.email, "A credit code is locked to an email address, and there isn't one"],
                                  ["none", "Nothing", null, true, ""],
                                ] as const).map(([m, label, Icon, enabled, why]) => (
                                  <button
                                    key={m}
                                    type="button"
                                    disabled={!enabled}
                                    title={!enabled ? why : undefined}
                                    onClick={() => setChoice(f.parentId, { method: m })}
                                    className={cn(
                                      "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                      choice.method === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                    )}
                                  >
                                    {Icon && <Icon className="h-3.5 w-3.5" />}
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {choice.method !== "none" && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">£</span>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={choice.amount}
                                    onChange={(e) => setChoice(f.parentId, { amount: e.target.value })}
                                    className="h-8 w-24 text-xs tabular-nums"
                                    aria-label={`Amount for ${f.parentName ?? "this family"}`}
                                  />
                                  {amountOf(f.parentId) !== f.owed && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground underline-offset-2 hover:underline"
                                      onClick={() => setChoice(f.parentId, { amount: f.owed.toFixed(2) })}
                                    >
                                      pro rata {money(f.owed)}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-muted-foreground">Nothing owed.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(preview.memberships > 0 || preview.pendingInvites > 0 || preview.pastBookings > 0) && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {preview.memberships > 0 && (
                    <p>
                      {preview.memberships} monthly {plural(preview.memberships, "membership", "memberships")} will be ended in Stripe
                      today, so nobody is charged again for this class.
                    </p>
                  )}
                  {preview.pendingInvites > 0 && (
                    <p>
                      {preview.pendingInvites} unpaid payment {plural(preview.pendingInvites, "link", "links")} for this class will be withdrawn.
                    </p>
                  )}
                  {preview.pastBookings > 0 && (
                    <p>
                      {preview.pastBookings} {plural(preview.pastBookings, "place", "places")} on nights that have already
                      happened {plural(preview.pastBookings, "is", "are")} left alone, so those registers still read correctly.
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" /> {money(toCard)} to cards · {money(toCredit)} as credit
                </p>
                <p className="mt-1">
                  Card refunds are made in Stripe the moment you confirm and can't be undone. Credit codes go
                  out in the email and work at checkout for six months.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cancel-message">What the parents will be told</Label>
                <Textarea
                  id="cancel-message"
                  rows={9}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Sent to each family once, in the studio's branded email, with their refund or credit code added
                  underneath and replies coming back to you.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4">
          {done ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Keep the class
              </Button>
              <Button
                onClick={confirm}
                disabled={!preview || submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Cancelling and settling up…</>
                  : <><Mail className="mr-1.5 h-4 w-4" /> {reachable === 0
                      ? "Cancel the class"
                      : `Cancel, settle up and tell ${reachable} ${plural(reachable, "family", "families")}`}</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelClassDialog;
