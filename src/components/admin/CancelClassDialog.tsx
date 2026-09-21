import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, Users } from "lucide-react";
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

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  students: string[];
  bookingIds: string[];
  paid: number;
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
  liveMemberships: { id: string; status: string; monthlyAmount: number; studentName: string | null }[];
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

/**
 * Take a class down without losing the people who were on it.
 *
 * The old route was Delete, which cascaded: the bookings went, and with them
 * every parent's name and email. Amie found that out at 8pm with a
 * cancellation to send and nobody to send it to. This cancels the places and
 * keeps them, retires the class, and emails the families her words.
 */
const CancelClassDialog = ({ open, onOpenChange, classId, className, onDone }: Props) => {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ emailed: number; cancelledBookings: number; families: Family[] } | null>(null);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setPreview(null);
    setDone(null);
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
    setPreview(data as Preview);
  }, [classId, toast]);

  useEffect(() => {
    if (!open) return;
    setMessage(
      `We are unfortunately writing to let you know that, due to low numbers, we have made the difficult decision to cancel ${className}.\n\n` +
        `We are incredibly grateful for your support and for everyone who signed up and gave our classes a chance.\n\n` +
        `Any remaining balance on your account has now been refunded, and there is nothing further you need to do.\n\n` +
        `We are really sorry for any disappointment this may cause, and we hope to see you and your dancers at one of our other classes in the future.\n\n` +
        `Amie\nThe Dance Exclusive`,
    );
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  const blocked = (preview?.liveMemberships.length ?? 0) > 0;
  // Only families we can actually reach. Promising to tell three and emailing
  // two is the kind of small lie that costs trust the first time it shows.
  const reachable = preview?.families.filter((f) => f.email).length ?? 0;

  const confirm = async () => {
    if (!classId || !preview) return;
    if (!message.trim()) {
      toast({ title: "Write the message parents will get", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("cancel-class", {
      body: { classId, message: message.trim(), notify: true },
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
    const res = data as { emailed: number; cancelledBookings: number; families: Family[] };
    setDone(res);
    toast({
      title: `${preview.className} cancelled`,
      description: `${res.cancelledBookings} booking${res.cancelledBookings === 1 ? "" : "s"} cancelled and kept · ${res.emailed} famil${res.emailed === 1 ? "y" : "ies"} emailed.`,
    });
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-dialog flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{done ? "Class cancelled" : `Cancel ${className}?`}</DialogTitle>
          <DialogDescription>
            {done
              ? "Everyone's place has been cancelled and kept on record."
              : "The class stops being sold and comes off the timetable. Nobody is deleted."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking who's on this class…
            </p>
          )}

          {done && (
            <div className="space-y-2">
              {done.families.map((f) => (
                <div key={f.parentId} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{f.parentName ?? "Parent"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.students.join(", ") || "—"}{f.email ? ` · ${f.email}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs ${f.emailed ? "text-[hsl(var(--success-strong))]" : "text-destructive"}`}>
                    {f.emailed ? "Emailed" : f.reason ?? "Not emailed"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {preview && !done && (
            <>
              {blocked && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Monthly memberships are still live
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {preview.liveMemberships.length} famil{preview.liveMemberships.length === 1 ? "y is" : "ies are"} still
                    paying monthly for this class. End those under Bookings → Memberships &amp; Plans first,
                    otherwise they keep being charged for a class that isn't running.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Families", value: String(preview.families.length) },
                  { label: "Places", value: String(preview.bookingCount) },
                  { label: "Paid in total", value: money(preview.totalPaid) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border p-2.5">
                    <p className="text-base font-semibold tabular-nums">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {preview.families.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Who will be told
                  </p>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-2.5 text-xs">
                    {preview.families.map((f) => (
                      <div key={f.parentId}>
                        <p className="truncate">
                          {f.parentName ?? "Parent"}
                          <span className="text-muted-foreground">
                            {f.students.length > 0 && ` · ${f.students.join(", ")}`}
                            {f.paid > 0 && ` · paid ${money(f.paid)}`}
                          </span>
                        </p>
                        {/* Its own line, because "no email on file" is the one
                            thing on this list Amie has to act on, and it was
                            the first thing to get cut off when it shared. */}
                        <p className={f.email ? "truncate text-muted-foreground" : "font-medium text-destructive"}>
                          {f.email ?? "No email on file — you'll need to tell them another way"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.pendingInvites > 0 && (
                <p className="text-xs text-muted-foreground">
                  {preview.pendingInvites} unpaid payment link{preview.pendingInvites === 1 ? "" : "s"} for this class
                  will be withdrawn, so nobody can still pay for it.
                </p>
              )}

              {preview.pastBookings > 0 && (
                <p className="text-xs text-muted-foreground">
                  {preview.pastBookings} place{preview.pastBookings === 1 ? "" : "s"} on nights that have already
                  happened {preview.pastBookings === 1 ? "is" : "are"} left alone, so those registers still read correctly.
                </p>
              )}

              <p className="rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3 text-xs text-muted-foreground">
                Refunds are not made here. {preview.totalPaid > 0
                  ? `${money(preview.totalPaid)} has been taken for this class — refund what's owed in Stripe.`
                  : "Nothing has been paid for this class."}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="cancel-message">What the parents will be told</Label>
                <Textarea
                  id="cancel-message"
                  rows={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Sent to each family once, in the studio's branded email, with replies coming back to you.
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
                disabled={!preview || blocked || submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Cancelling…</>
                  : <><Mail className="mr-1.5 h-4 w-4" /> {reachable === 0
                      ? "Cancel the class"
                      : `Cancel and tell ${reachable} famil${reachable === 1 ? "y" : "ies"}`}</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelClassDialog;
