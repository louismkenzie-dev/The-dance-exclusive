import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Check, Clock, Copy, Loader2, Mail, MapPin, MessageCircle, Phone, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BookingBreakdown, { type PaymentSibling } from "@/components/admin/BookingBreakdown";
import { attendeeKey, convertedAfterTrial, type Purchase } from "@/lib/trialConversion";
import { BookingActions, type BookingActionHandlers } from "@/components/admin/BookingActions";
import { TonePill } from "@/components/admin/StatusPill";
import { Chip, ChipRow } from "@/components/booking/Chips";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTime } from "@/lib/bookingFormat";

interface TrialRow {
  id: string;
  parent_id: string;
  student_id: string | null;
  class_id: string | null;
  camp_id: string | null;
  status: string;
  booking_type: string;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  classes: {
    name: string;
    class_type: "children" | "adult";
    day_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    price_per_session: number | null;
    price_per_term: number | null;
    price_per_month: number | null;
    price_per_year: number | null;
    term_end: string | null;
    venues: { name: string } | null;
  } | null;
  students: { first_name: string; last_name: string } | null;
}

/** One recorded attempt to get a trialist back. */
interface ChaseRow {
  id: string;
  booking_id: string;
  method: "email" | "whatsapp" | "call" | "copy";
  chased_at: string;
  email_log_id: string | null;
}

/** What happened to an email after we handed it to Resend. */
interface EmailRow {
  id: string;
  status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed";
  delivered_at: string | null;
  opened_at: string | null;
}

const METHOD_LABEL: Record<ChaseRow["method"], string> = {
  email: "emailed",
  whatsapp: "WhatsApp",
  call: "called",
  copy: "copied",
};

/**
 * What the studio needs to know at a glance about the last email: not that we
 * sent it — that it arrived, and whether anyone opened it. "Sent" on its own
 * is the state Amie already had, and it told her nothing.
 */
const DELIVERY: Record<EmailRow["status"], { label: string; tone?: "success" | "warning" | "destructive" }> = {
  sent: { label: "sent" },
  delivered: { label: "delivered", tone: "success" },
  opened: { label: "opened", tone: "success" },
  clicked: { label: "clicked through", tone: "success" },
  bounced: { label: "bounced", tone: "destructive" },
  complained: { label: "marked as spam", tone: "destructive" },
  failed: { label: "failed to send", tone: "destructive" },
};

interface TrialsTabProps {
  /** The same row actions the Bookings tab uses. */
  actions: BookingActionHandlers;
  paymentSiblings: (b: TrialRow) => PaymentSibling[];
  /** Bumped by the Bookings page when an action changed something. */
  changeToken: number;
}

/**
 * What to say when following a trial up. Written out here rather than left to
 * whoever is holding the phone, so nobody has to compose it at 9pm — and so
 * the child's name and the class they came to are always in it.
 */
const followUpText = (
  parentName: string | null | undefined,
  childName: string,
  className: string | null | undefined,
  date: string | null,
): string => {
  const first = parentName?.trim().split(/\s+/)[0] || "there";
  const when = date ? ` on ${format(parseISO(date), "EEEE d MMMM")}` : "";
  return `Hi ${first}, it's Amie at The Dance Exclusive. Just wanted to see how ${childName} got on at ${className ?? "their trial"}${when}? We'd love to have them back — any questions at all, just ask. 💙`;
};

/** UK mobile to the form wa.me wants: 447… with nothing else in it. */
const waNumber = (phone: string): string => {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return digits;
};

/** Trials carry their session date in the notes: "... | session YYYY-MM-DD". */
const trialDate = (notes: string | null): string | null =>
  notes?.match(/session (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Amie's trial list: who's coming, when, whether they turned up, and whether
 * they went on to book something. Trials are the studio's main conversion
 * step, so they get their own view rather than being buried in bookings.
 */
const TrialsTab = ({ actions, paymentSiblings, changeToken }: TrialsTabProps) => {
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [parents, setParents] = useState<Record<string, { full_name: string; email: string; phone: string | null }>>({});
  const [attended, setAttended] = useState<Record<string, { checked_in_at: string | null; status: string }>>({});
  /** Attendee keys (see attendeeKey) who bought something after their trial. */
  const [convertedAttendees, setConvertedAttendees] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  /** Every chase on record, newest first, keyed by booking. */
  const [chases, setChases] = useState<Record<string, ChaseRow[]>>({});
  /** What became of each chase email, keyed by email_log id. */
  const [emails, setEmails] = useState<Record<string, EmailRow>>({});
  /** Bookings with a send in flight, so their button can't be pressed twice. */
  const [chasing, setChasing] = useState<Set<string>>(new Set());
  const [confirmChaseAll, setConfirmChaseAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select(`id, parent_id, student_id, class_id, camp_id, status, booking_type, amount, booked_at, notes,
        classes:class_id ( name, class_type, day_of_week, start_time, end_time, price_per_session,
          price_per_term, price_per_month, price_per_year, term_end, venues:venue_id ( name ) ),
        students:student_id ( first_name, last_name )`)
      .eq("booking_type", "trial")
      .order("booked_at", { ascending: false });
    const rows = ((data as unknown as TrialRow[]) ?? []);
    setTrials(rows);

    const parentIds = [...new Set(rows.map((t) => t.parent_id).filter(Boolean))];
    if (parentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", parentIds);
      setParents(Object.fromEntries(((profs as any[]) ?? []).map((p) => [p.user_id, p])));

      // "Converted" = THIS DANCER bought something after their trial.
      // Anything held beforehand isn't the trial's doing, so the date
      // matters — and so does who it was for: a dad booking his own adult
      // class is not his son taking up dancing.
      const [{ data: mems }, { data: paid }] = await Promise.all([
        supabase.from("memberships").select("user_id, student_id, created_at")
          .in("user_id", parentIds)
          .in("status", ["active", "paused", "past_due", "cancel_scheduled"]),
        supabase.from("bookings").select("parent_id, student_id, booked_at")
          .in("parent_id", parentIds)
          .eq("status", "confirmed")
          .in("booking_type", ["monthly", "term", "yearly", "session", "camp"]),
      ]);
      const purchases: Purchase[] = [
        ...((mems as any[]) ?? []).map((m) => ({ studentId: m.student_id, parentId: m.user_id, at: m.created_at })),
        ...((paid as any[]) ?? []).map((b) => ({ studentId: b.student_id, parentId: b.parent_id, at: b.booked_at })),
      ];
      // Their first trial is the line everything is measured from.
      const firstTrialAt: Record<string, string> = {};
      for (const t of rows) {
        const key = attendeeKey(t.student_id, t.parent_id);
        if (!firstTrialAt[key] || t.booked_at < firstTrialAt[key]) firstTrialAt[key] = t.booked_at;
      }
      const converted = new Set<string>();
      for (const t of rows) {
        const key = attendeeKey(t.student_id, t.parent_id);
        if (converted.has(key)) continue;
        if (convertedAfterTrial(purchases, t.student_id, t.parent_id, firstTrialAt[key])) converted.add(key);
      }
      setConvertedAttendees(converted);
    }

    const bookingIds = rows.map((t) => t.id);
    if (bookingIds.length > 0) {
      const { data: att } = await supabase
        .from("attendance")
        .select("booking_id, checked_in_at, status")
        .in("booking_id", bookingIds);
      setAttended(Object.fromEntries(((att as any[]) ?? []).map((a) => [a.booking_id, a])));

      // Who has already been chased, and what became of the email. Read
      // together so a card never shows "emailed" without saying whether it
      // landed — that pairing is the whole point of keeping the record.
      const { data: chaseRows } = await supabase
        .from("trial_chases")
        .select("id, booking_id, method, chased_at, email_log_id")
        .in("booking_id", bookingIds)
        .order("chased_at", { ascending: false });
      const byBooking: Record<string, ChaseRow[]> = {};
      for (const c of ((chaseRows as any[]) ?? [])) {
        (byBooking[c.booking_id] ??= []).push(c as ChaseRow);
      }
      setChases(byBooking);

      const logIds = [...new Set(((chaseRows as any[]) ?? []).map((c) => c.email_log_id).filter(Boolean))];
      if (logIds.length > 0) {
        const { data: logs } = await supabase
          .from("email_log")
          .select("id, status, delivered_at, opened_at")
          .in("id", logIds);
        setEmails(Object.fromEntries(((logs as any[]) ?? []).map((l) => [l.id, l as EmailRow])));
      } else {
        setEmails({});
      }
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load, changeToken]);

  const visible = useMemo(() => {
    const today = todayISO();
    const withDate = trials.map((t) => ({ trial: t, date: trialDate(t.notes) }));
    const rows = withDate.filter(({ trial, date }) => {
      if (trial.status === "cancelled") return filter === "all";
      if (filter === "all") return true;
      if (!date) return filter === "upcoming"; // undated trials still need chasing
      return filter === "upcoming" ? date >= today : date < today;
    });
    // Soonest first for upcoming, most recent first for past.
    return rows.sort((a, b) => {
      const da = a.date ?? "9999-12-31";
      const db = b.date ?? "9999-12-31";
      return filter === "past" ? db.localeCompare(da) : da.localeCompare(db);
    });
  }, [trials, filter]);

  const upcomingCount = useMemo(() => {
    const today = todayISO();
    return trials.filter((t) => t.status !== "cancelled" && (trialDate(t.notes) ?? "9999") >= today).length;
  }, [trials]);

  const pastCount = trials.filter((t) => t.status !== "cancelled" && !!trialDate(t.notes) && trialDate(t.notes)! < todayISO()).length;

  /** Been, not booked, not cancelled — everyone "Chase all" would write to. */
  const chaseable = useMemo(() => {
    const today = todayISO();
    return trials.filter((t) => {
      const d = trialDate(t.notes);
      if (!d || d >= today) return false;
      if (t.status === "cancelled") return false;
      return !convertedAttendees.has(attendeeKey(t.student_id, t.parent_id));
    });
  }, [trials, convertedAttendees]);

  /** Families, not bookings: siblings on one night share one email. */
  const chaseableFamilies = useMemo(() => {
    const keys = new Set(chaseable.map((t) => `${t.parent_id}|${t.class_id}|${trialDate(t.notes)}`));
    return keys.size;
  }, [chaseable]);

  /**
   * Send the same "how was it, come and book" email the evening cron sends,
   * on purpose. The server does the sending and the recording; here we only
   * report what came back, per family, including who was skipped and why.
   */
  const sendChase = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setChasing((prev) => new Set([...prev, ...ids]));
    try {
      const { data, error } = await supabase.functions.invoke("chase-trials", {
        body: { bookingIds: ids },
      });
      if (error) throw error;
      const res = data as { sent: number; total: number; results: { sent: boolean; reason?: string; studentName?: string | null }[] };
      const skipped = (res.results ?? []).filter((r) => !r.sent);
      if (res.sent > 0) {
        toast.success(
          res.sent === 1 ? "Chase sent" : `${res.sent} chases sent`,
          skipped.length > 0
            ? { description: `${skipped.length} skipped — ${skipped[0].reason}` }
            : undefined,
        );
      } else {
        toast("Nothing sent", {
          description: skipped[0]?.reason ?? "No trials were eligible.",
        });
      }
      await load();
    } catch (e) {
      toast.error("Couldn't send", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setChasing((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [load]);

  /**
   * A chase that happened outside the app — Amie tapped WhatsApp, or rang
   * them. Recorded so the next person to look at this family knows, and
   * doesn't make it the fourth message this week.
   */
  const recordChase = useCallback(async (t: TrialRow, method: ChaseRow["method"]) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("trial_chases").insert({
      booking_id: t.id,
      parent_id: t.parent_id,
      student_id: t.student_id,
      method,
      chased_by: auth?.user?.id ?? null,
    });
    if (error) {
      // The contact still happened; only the bookkeeping failed.
      console.error("Could not record chase:", error.message);
      return;
    }
    await load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {trials.length === 0
            ? "Trial bookings will appear here."
            : <>
                <strong className="text-foreground">{trials.length}</strong> trial{trials.length === 1 ? "" : "s"} booked
                {upcomingCount > 0 && <> · <strong className="text-[hsl(var(--success-strong))]">{upcomingCount} still to come</strong></>}
              </>}
        </p>
        <ChipRow>
          <Chip selected={filter === "upcoming"} onClick={() => setFilter("upcoming")} trailing={upcomingCount}>Coming up</Chip>
          <Chip selected={filter === "past"} onClick={() => setFilter("past")} trailing={pastCount}>Already happened</Chip>
          <Chip selected={filter === "all"} onClick={() => setFilter("all")} trailing={trials.length}>All trials</Chip>
        </ChipRow>

        {chaseable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3">
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-sm font-medium">
                {chaseable.length} trial{chaseable.length === 1 ? "" : "s"} h{chaseable.length === 1 ? "as" : "ave"} been and not booked
              </p>
              <p className="text-xs text-muted-foreground">
                Invite them to book — one email each{chaseableFamilies !== chaseable.length && `, ${chaseableFamilies} in total (siblings share one)`}.
              </p>
            </div>
            <Button
              size="sm"
              className="h-9 rounded-full"
              disabled={chasing.size > 0}
              onClick={() => setConfirmChaseAll(true)}
            >
              {chasing.size > 0
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Chase all {chaseableFamilies}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmChaseAll} onOpenChange={setConfirmChaseAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Email {chaseableFamilies} famil{chaseableFamilies === 1 ? "y" : "ies"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Each one gets the "how was it — book your place" email, with a link
                  to the class they trialled. Anyone chased in the last 6 hours is
                  skipped automatically.
                </p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-muted/40 p-2 text-xs">
                  {chaseable.map((t) => (
                    <li key={t.id} className="truncate">
                      {t.students ? `${t.students.first_name} ${t.students.last_name}` : "Adult attendee"}
                      <span className="text-muted-foreground">
                        {" · "}{t.classes?.name ?? "Class"}
                        {parents[t.parent_id] ? ` · ${parents[t.parent_id].email}` : " · no email on file"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void sendChase(chaseable.map((t) => t.id))}>
              Send {chaseableFamilies} email{chaseableFamilies === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {trials.length === 0 ? "No trials booked yet." : "Nothing in this view — try another filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(({ trial: t, date }) => {
            const parent = parents[t.parent_id];
            const att = attended[t.id];
            const past = !!date && date < todayISO();
            const converted = convertedAttendees.has(attendeeKey(t.student_id, t.parent_id));
            return (
              <Card key={t.id} className="animate-fade-in overflow-hidden">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 basis-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">
                          {t.students ? `${t.students.first_name} ${t.students.last_name}` : "Adult attendee"}
                        </span>
                        {t.status === "cancelled" && <TonePill>Cancelled</TonePill>}
                      </div>
                      <p className="text-sm text-foreground/90">
                        {t.classes?.name ?? "Class"}
                        {t.classes?.venues?.name && (
                          <span className="text-muted-foreground"> · {t.classes.venues.name}</span>
                        )}
                      </p>

                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {date ? format(parseISO(date), "EEE d MMM yyyy") : "Date not set"}
                        </span>
                        {t.classes?.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> {formatTime(t.classes.start_time)}
                          </span>
                        )}
                        {t.classes?.venues?.name && (
                          <span className="hidden items-center gap-1 md:flex">
                            <MapPin className="h-3.5 w-3.5" /> {t.classes.venues.name}
                          </span>
                        )}
                      </p>

                      {parent && (
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{parent.full_name}</span>
                          <a href={`mailto:${parent.email}`} className="flex min-w-0 items-center gap-1 hover:text-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{parent.email}</span>
                          </a>
                          {parent.phone && (
                            <a href={`tel:${parent.phone}`} className="flex items-center gap-1 hover:text-foreground">
                              <Phone className="h-3.5 w-3.5" />{parent.phone}
                            </a>
                          )}
                        </p>
                      )}

                      {past && !converted && t.status !== "cancelled" && parent && (() => {
                        const childName = t.students?.first_name ?? "your dancer";
                        const text = followUpText(parent.full_name, childName, t.classes?.name, date);
                        const busy = chasing.has(t.id);
                        return (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              size="sm" className="h-9 rounded-full"
                              disabled={busy}
                              onClick={() => void sendChase([t.id])}
                            >
                              {busy
                                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                : <Send className="mr-1.5 h-3.5 w-3.5" />}
                              Chase by email
                            </Button>
                            {parent.phone && (
                              <Button
                                asChild size="sm" variant="outline"
                                className="h-9 rounded-full px-3"
                                onClick={() => void recordChase(t, "whatsapp")}
                              >
                                <a
                                  href={`https://wa.me/${waNumber(parent.phone)}?text=${encodeURIComponent(text)}`}
                                  target="_blank" rel="noopener noreferrer"
                                >
                                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                                </a>
                              </Button>
                            )}
                            <Button
                              asChild size="sm" variant="outline" className="h-9 rounded-full px-3"
                              onClick={() => void recordChase(t, "email")}
                            >
                              <a href={`mailto:${parent.email}?subject=${encodeURIComponent(`How did ${childName} get on?`)}&body=${encodeURIComponent(text)}`}>
                                <Mail className="mr-1.5 h-3.5 w-3.5" /> Their inbox
                              </a>
                            </Button>
                            {parent.phone && (
                              <Button
                                asChild size="sm" variant="outline" className="h-9 rounded-full px-3"
                                onClick={() => void recordChase(t, "call")}
                              >
                                <a href={`tel:${parent.phone}`}>
                                  <Phone className="mr-1.5 h-3.5 w-3.5" /> Call
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost" className="h-9 rounded-full px-3"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(text);
                                  toast.success("Message copied", { description: text, duration: 10000 });
                                } catch {
                                  toast("Copy this", { description: text, duration: 15000 });
                                }
                                void recordChase(t, "copy");
                              }}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                            </Button>
                          </div>
                        );
                      })()}

                      {(() => {
                        // The record Louis asked for: when, how, by which
                        // route — and for an email, whether it actually
                        // arrived and was opened. Newest first.
                        const history = chases[t.id] ?? [];
                        if (history.length === 0) return null;
                        const last = history[0];
                        const log = last.email_log_id ? emails[last.email_log_id] : null;
                        const delivery = log ? DELIVERY[log.status] : null;
                        return (
                          <p className="pt-0.5 text-xs text-muted-foreground">
                            <Check className="mr-1 inline h-3 w-3 align-[-1px]" />
                            Chased {history.length}×
                            {" · last "}
                            {format(parseISO(last.chased_at), "d MMM 'at' HH:mm")}
                            {" · "}{METHOD_LABEL[last.method]}
                            {delivery && (
                              <>
                                {" · "}
                                <span
                                  className={
                                    delivery.tone === "success"
                                      ? "text-[hsl(var(--success-strong))]"
                                      : delivery.tone === "destructive"
                                        ? "text-destructive"
                                        : undefined
                                  }
                                >
                                  {delivery.label}
                                </span>
                              </>
                            )}
                          </p>
                        );
                      })()}

                      {(converted || past) && t.status !== "cancelled" && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {converted ? (
                            <TonePill tone="success">Booked since — converted</TonePill>
                          ) : past ? (
                            <TonePill tone="warning">Not booked yet — follow up</TonePill>
                          ) : null}
                          {past && (
                            att?.checked_in_at
                              ? <TonePill tone="success">Attended</TonePill>
                              : att?.status === "absent"
                                ? <TonePill tone="destructive">No show</TonePill>
                                : <TonePill>Not marked</TonePill>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {t.amount != null && Number(t.amount) > 0 && (
                        <p className="font-semibold tabular-nums">£{Number(t.amount).toFixed(2)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Booked {format(parseISO(t.booked_at), "d MMM")}</p>
                    </div>

                    {actions.breakdownId === t.id && (
                      <div className="order-3 basis-full md:order-4">
                        <BookingBreakdown
                          booking={t as any}
                          parent={parent ?? null}
                          samePayment={paymentSiblings(t)}
                        />
                      </div>
                    )}
                    <div className="order-4 basis-full md:order-3 md:ml-1 md:basis-auto">
                      <BookingActions
                        booking={{ ...t, profiles: parent ?? null }}
                        actions={actions}
                        className="mt-0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrialsTab;
