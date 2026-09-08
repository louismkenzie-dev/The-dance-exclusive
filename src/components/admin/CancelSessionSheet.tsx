import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowRight, Check, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { Bone } from "@/components/booking/Skeletons";
import { formatTimeRange } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

type Outcome = "moved" | "carries_on" | "unmoved";

interface Line {
  bookingId: string;
  studentName: string | null;
  bookingType: string;
  outcome: Outcome;
  note?: string;
}

interface Family {
  parentId: string;
  parentName: string | null;
  email: string | null;
  lines: Line[];
}

interface SessionInfo {
  id: string;
  className: string;
  venueName: string | null;
  date: string;
  startTime: string;
  endTime: string;
}

interface TargetInfo {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface CancelSessionResult {
  sessionId: string;
  counts: Record<Outcome, number>;
  emailed: number;
  families: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The class session to cancel; the sheet loads everything else. */
  sessionId: string | null;
  onCancelled?: (result: CancelSessionResult) => void;
}

const planWord = (type: string) => {
  switch (type) {
    case "trial": return "trial";
    case "session":
    case "drop_in": return "session";
    case "monthly":
    case "termly":
    case "yearly":
    case "annual": return "weekly place";
    default: return "booking";
  }
};

const shortDate = (ymd: string) => format(parseISO(ymd), "EEE d MMM");

/** Pull the server's own message out of a failed function call. */
async function functionError(error: unknown, data: any): Promise<string> {
  let message = data?.error || (error as { message?: string } | null)?.message || "Please try again";
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) message = body.error;
    } catch { /* keep the generic message */ }
  }
  return message;
}

/**
 * The emergency button: cancel one session, move every dated booking to the
 * class's next date at no charge, leave standing places alone, and tell the
 * families. Shows exactly who is affected before anything happens.
 */
export function CancelSessionSheet({ open, onOpenChange, sessionId, onCancelled }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [alternatives, setAlternatives] = useState<TargetInfo[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fresh sheet for each session.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setNotify(true);
    setTargetId(null);
    setLoadError(null);
  }, [open, sessionId]);

  // Preview: who is booked and what would happen to each of them.
  useEffect(() => {
    if (!open || !sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase.functions.invoke("cancel-class-session", {
        body: { sessionId, preview: true, targetSessionId: targetId },
      });
      if (cancelled) return;
      if (error || data?.error) {
        setLoadError(await functionError(error, data));
      } else {
        setSession(data.session);
        setTarget(data.target);
        setAlternatives(data.alternatives ?? []);
        setFamilies(data.families ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, sessionId, targetId]);

  const lines = families.flatMap((f) => f.lines);
  const counts = lines.reduce(
    (acc, l) => { acc[l.outcome]++; return acc; },
    { moved: 0, carries_on: 0, unmoved: 0 } as Record<Outcome, number>,
  );

  const confirm = async () => {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-class-session", {
        body: { sessionId, targetSessionId: targetId ?? target?.id ?? null, notify, reason: reason.trim() || undefined },
      });
      if (error || data?.error) {
        toast({ title: "Couldn't cancel the class", description: await functionError(error, data), variant: "destructive" });
        return;
      }
      const c = data.counts as Record<Outcome, number>;
      const bits = [
        c.moved > 0 ? `${c.moved} moved to ${data.target ? shortDate(data.target.date) : "the next date"}` : null,
        c.carries_on > 0 ? `${c.carries_on} weekly place${c.carries_on === 1 ? "" : "s"} carry on` : null,
        c.unmoved > 0 ? `${c.unmoved} need${c.unmoved === 1 ? "s" : ""} a decision` : null,
        notify ? `${data.emailed} famil${data.emailed === 1 ? "y" : "ies"} emailed` : "families not emailed",
      ].filter(Boolean);
      toast({ title: `${data.session?.className ?? "Class"} cancelled`, description: bits.join(" · ") });
      if (Array.isArray(data.emailErrors) && data.emailErrors.length > 0) {
        toast({ title: "Some emails didn't send", description: data.emailErrors.join("; "), variant: "destructive" });
      }
      onCancelled?.({ sessionId, counts: c, emailed: data.emailed ?? 0, families: (data.families ?? []).length });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't cancel the class", description: e?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const ready = !loading && !loadError && !!session;
  const emailable = families.filter((f) => !!f.email).length;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}
      title="Cancel this class?"
      description={
        session
          ? `${session.className} · ${format(parseISO(session.date), "EEEE d MMMM")} · ${formatTimeRange(session.startTime, session.endTime)}${session.venueName ? ` · ${session.venueName}` : ""}`
          : "Checking who's booked…"
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            variant="destructive"
            disabled={!ready || submitting}
            onClick={() => void confirm()}
            className="h-12 flex-1 rounded-xl text-base font-semibold"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
            {submitting ? "Cancelling…" : "Cancel this class"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-xl text-base sm:w-auto"
          >
            Keep it running
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        {loadError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            <p className="font-semibold">Couldn't load this session</p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
          </div>
        ) : loading && !session ? (
          <div className="space-y-3">
            <Bone className="h-4 w-48" />
            <Bone className="h-16 w-full rounded-xl" />
            <Bone className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Who's booked and what happens to each of them */}
            <section>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Who's booked · {lines.length}
              </h3>
              {families.length === 0 ? (
                <p className="mt-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Nobody is booked on this date. Cancelling only takes it off the register and timetable.
                </p>
              ) : (
                <ul className={cn("mt-2 divide-y divide-border/70 rounded-xl border border-border", loading && "opacity-60")}>
                  {families.map((f) => (
                    <li key={f.parentId} className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-foreground">
                        {f.parentName ?? "Unknown family"}
                        {!f.email && <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-warning">no email</span>}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {f.lines.map((l) => (
                          <li key={l.bookingId} className="flex items-start gap-2 text-[13px]">
                            {l.outcome === "moved" ? (
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                            ) : l.outcome === "carries_on" ? (
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success-strong))]" aria-hidden />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning-strong))]" aria-hidden />
                            )}
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{l.studentName ?? "Adult attendee"}</span>
                              {" · "}{planWord(l.bookingType)}{" — "}
                              {l.outcome === "moved" && target
                                ? `moves to ${shortDate(target.date)}, nothing to pay`
                                : l.outcome === "carries_on"
                                  ? "carries on next week, billing unchanged"
                                  : `stays put: ${l.note ?? "needs a decision"}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Where dated bookings go */}
            {counts.moved + counts.unmoved > 0 && (
              <section>
                <label className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="cancel-target">
                  Move dated bookings to
                </label>
                {alternatives.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                    There's no later date for this class yet, so dated bookings stay where they are. They're listed above for you to sort out by hand.
                  </p>
                ) : (
                  <Select value={targetId ?? target?.id ?? ""} onValueChange={(v) => setTargetId(v)}>
                    <SelectTrigger id="cancel-target" className="mt-2 h-12 rounded-xl text-base">
                      <SelectValue placeholder="Choose a date" />
                    </SelectTrigger>
                    <SelectContent>
                      {alternatives.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="py-2.5">
                          {format(parseISO(a.date), "EEEE d MMMM")} · {formatTimeRange(a.startTime, a.endTime)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </section>
            )}

            {/* Why — goes in the email and the session's notes */}
            <section>
              <label className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="cancel-reason">
                Reason <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <Input
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Power cut at the venue"
                maxLength={200}
                className="mt-2 h-12 rounded-xl text-base"
              />
            </section>

            {/* Tell the families */}
            <section className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Email the families</p>
                <p className="text-[13px] text-muted-foreground">
                  {emailable === 0
                    ? "No one to email."
                    : `${emailable} famil${emailable === 1 ? "y" : "ies"} get a short email saying the class is off and what happens to their booking.`}
                </p>
              </div>
              <Switch checked={notify && emailable > 0} disabled={emailable === 0} onCheckedChange={setNotify} aria-label="Email the families" />
            </section>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}

export default CancelSessionSheet;
