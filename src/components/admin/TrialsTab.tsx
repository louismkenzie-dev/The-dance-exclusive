import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import BookingBreakdown, { type PaymentSibling } from "@/components/admin/BookingBreakdown";
import { BookingActions, type BookingActionHandlers } from "@/components/admin/BookingActions";
import { TonePill } from "@/components/admin/StatusPill";
import { Chip, ChipRow } from "@/components/booking/Chips";

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

interface TrialsTabProps {
  /** The same row actions the Bookings tab uses. */
  actions: BookingActionHandlers;
  paymentSiblings: (b: TrialRow) => PaymentSibling[];
  /** Bumped by the Bookings page when an action changed something. */
  changeToken: number;
}

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
  const [convertedParents, setConvertedParents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

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

      // "Converted" = they bought something after the trial. Anything they
      // already held beforehand isn't the trial's doing, so the date matters.
      const [{ data: mems }, { data: paid }] = await Promise.all([
        supabase.from("memberships").select("user_id, created_at")
          .in("user_id", parentIds)
          .in("status", ["active", "paused", "past_due", "cancel_scheduled"]),
        supabase.from("bookings").select("parent_id, booked_at")
          .in("parent_id", parentIds)
          .eq("status", "confirmed")
          .in("booking_type", ["monthly", "term", "yearly", "session", "camp"]),
      ]);
      const boughtAt: Record<string, string[]> = {};
      for (const m of ((mems as any[]) ?? [])) (boughtAt[m.user_id] ??= []).push(m.created_at);
      for (const b of ((paid as any[]) ?? [])) (boughtAt[b.parent_id] ??= []).push(b.booked_at);
      const firstTrialAt: Record<string, string> = {};
      for (const t of rows) {
        const seen = firstTrialAt[t.parent_id];
        if (!seen || t.booked_at < seen) firstTrialAt[t.parent_id] = t.booked_at;
      }
      setConvertedParents(new Set(
        Object.entries(boughtAt)
          .filter(([userId, dates]) => dates.some((d) => d && d > (firstTrialAt[userId] ?? "")))
          .map(([userId]) => userId),
      ));
    }

    const bookingIds = rows.map((t) => t.id);
    if (bookingIds.length > 0) {
      const { data: att } = await supabase
        .from("attendance")
        .select("booking_id, checked_in_at, status")
        .in("booking_id", bookingIds);
      setAttended(Object.fromEntries(((att as any[]) ?? []).map((a) => [a.booking_id, a])));
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
      </div>

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
            const converted = convertedParents.has(t.parent_id);
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
                            <Clock className="h-3.5 w-3.5" /> {t.classes.start_time.slice(0, 5)}
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
