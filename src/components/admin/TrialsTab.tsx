import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, Mail, MapPin, Phone, Sparkles, User } from "lucide-react";

interface TrialRow {
  id: string;
  parent_id: string;
  student_id: string | null;
  class_id: string | null;
  status: string;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  classes: { name: string; day_of_week: string | null; start_time: string | null; venues: { name: string } | null } | null;
  students: { first_name: string; last_name: string } | null;
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
const TrialsTab = () => {
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const [parents, setParents] = useState<Record<string, { full_name: string; email: string; phone: string | null }>>({});
  const [attended, setAttended] = useState<Record<string, { checked_in_at: string | null; status: string }>>({});
  const [convertedParents, setConvertedParents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select(`id, parent_id, student_id, class_id, status, amount, booked_at, notes,
        classes:class_id ( name, day_of_week, start_time, venues:venue_id ( name ) ),
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

      // "Converted" = this family holds any paying plan beyond the trial.
      const [{ data: mems }, { data: paid }] = await Promise.all([
        supabase.from("memberships").select("user_id")
          .in("user_id", parentIds)
          .in("status", ["active", "paused", "past_due", "cancel_scheduled"]),
        supabase.from("bookings").select("parent_id")
          .in("parent_id", parentIds)
          .eq("status", "confirmed")
          .in("booking_type", ["monthly", "term", "yearly", "session", "camp"]),
      ]);
      setConvertedParents(new Set([
        ...((mems as any[]) ?? []).map((m) => m.user_id),
        ...((paid as any[]) ?? []).map((b) => b.parent_id),
      ]));
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
  useEffect(() => { void load(); }, [load]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {trials.length === 0
            ? "Trial bookings will appear here."
            : <>
                <strong className="text-foreground">{trials.length}</strong> trial{trials.length === 1 ? "" : "s"} booked
                {upcomingCount > 0 && <> · <strong className="text-green-500">{upcomingCount} still to come</strong></>}
              </>}
        </p>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Coming up</SelectItem>
            <SelectItem value="past">Already happened</SelectItem>
            <SelectItem value="all">All trials</SelectItem>
          </SelectContent>
        </Select>
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
              <Card key={t.id} className="animate-fade-in">
                <CardContent className="py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold flex items-center gap-1.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {t.students ? `${t.students.first_name} ${t.students.last_name}` : "Adult attendee"}
                      </span>
                      <Badge variant="outline">{t.classes?.name ?? "Class"}</Badge>
                      {t.status === "cancelled" && <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>}
                      {converted && (
                        <Badge className="bg-emerald-600 text-white">Booked with us since</Badge>
                      )}
                      {past && !converted && t.status !== "cancelled" && (
                        <Badge className="bg-amber-500 text-white">Follow up</Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                      {date ? (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" /> {format(parseISO(date), "EEE d MMM yyyy")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" /> Date not set
                        </span>
                      )}
                      {t.classes?.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {t.classes.start_time.slice(0, 5)}
                        </span>
                      )}
                      {t.classes?.venues?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {t.classes.venues.name}
                        </span>
                      )}
                    </p>

                    {parent && (
                      <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>{parent.full_name}</span>
                        <a href={`mailto:${parent.email}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="w-3.5 h-3.5" />{parent.email}
                        </a>
                        {parent.phone && (
                          <a href={`tel:${parent.phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="w-3.5 h-3.5" />{parent.phone}
                          </a>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      Booked {format(parseISO(t.booked_at), "d MMM")}
                    </span>
                    {past && (
                      att?.checked_in_at
                        ? <Badge className="bg-emerald-600 text-white">Attended</Badge>
                        : att?.status === "absent"
                          ? <Badge variant="destructive">No show</Badge>
                          : <Badge variant="outline">Not marked</Badge>
                    )}
                    {t.amount != null && Number(t.amount) > 0 && (
                      <span className="text-sm font-semibold">£{Number(t.amount).toFixed(2)}</span>
                    )}
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
