import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { expectedSessionDates, missingSessionDates } from "@/lib/timetableGaps";
import { countPinnedBookings } from "@/lib/sessionGuards";

/**
 * "Is every class on the timetable every week it should be?"
 *
 * Lists, per active class, the upcoming weekday dates inside its terms that
 * have no session row — so a class generated on alternate weeks, or a date
 * deleted from the Calendar, is visible at a glance instead of being found
 * by a parent. Dates parents have already booked are flagged: those need
 * either the session put back or the bookings moved. Adding dates back is
 * one click; nothing here ever deletes.
 */

interface GapClass {
  id: string;
  name: string;
  class_type: "children" | "adult";
  venue: string | null;
  start_time: string;
  end_time: string;
  instructor_id: string | null;
  /** Missing upcoming dates, with how many confirmed bookings sit on each. */
  gaps: { date: string; booked: number }[];
}

export const TimetableGaps = () => {
  const [rows, setRows] = useState<GapClass[] | null>(null);
  const [review, setReview] = useState<GapClass | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const [{ data: classes }, { data: terms }, { data: holidays }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, class_type, day_of_week, days_of_week, term_start, term_end, start_time, end_time, instructor_id, venues:venue_id ( name )")
        .eq("is_active", true)
        .gte("term_end", today),
      supabase.from("school_terms").select("id, start_date, end_date"),
      supabase.from("school_holidays").select("start_date, end_date"),
    ]);
    const classList = (classes as any[]) ?? [];
    if (classList.length === 0) { setRows([]); return; }

    const classIds = classList.map((c) => c.id);
    const [{ data: sessions }, { data: bookings }] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("class_id, session_date")
        .in("class_id", classIds)
        .gte("session_date", today),
      supabase
        .from("bookings")
        .select("class_id, notes")
        .in("class_id", classIds)
        .eq("status", "confirmed")
        .ilike("notes", "%session 20%"),
    ]);
    const existing = new Map<string, Set<string>>();
    for (const s of (sessions as { class_id: string; session_date: string }[]) ?? []) {
      if (!existing.has(s.class_id)) existing.set(s.class_id, new Set());
      existing.get(s.class_id)!.add(s.session_date);
    }

    const result: GapClass[] = [];
    for (const c of classList) {
      const expected = expectedSessionDates(c, (terms as any[]) ?? [], (holidays as any[]) ?? [], today);
      const missing = missingSessionDates(expected, existing.get(c.id) ?? []);
      if (missing.length === 0) continue;
      const refs = missing.map((date) => ({ id: `${c.id}|${date}`, class_id: c.id, session_date: date }));
      const booked = countPinnedBookings((bookings as { class_id: string; notes: string | null }[]) ?? [], refs);
      result.push({
        id: c.id,
        name: c.name,
        class_type: c.class_type,
        venue: c.venues?.name ?? null,
        start_time: c.start_time,
        end_time: c.end_time,
        instructor_id: c.instructor_id,
        gaps: missing.map((date) => ({ date, booked: booked.get(`${c.id}|${date}`) ?? 0 })),
      });
    }
    result.sort((a, b) => {
      const bookedDiff = b.gaps.filter((g) => g.booked > 0).length - a.gaps.filter((g) => g.booked > 0).length;
      return bookedDiff || (a.venue ?? "").localeCompare(b.venue ?? "") || a.name.localeCompare(b.name);
    });
    setRows(result);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const bookedGapCount = useMemo(
    () => (rows ?? []).reduce((n, r) => n + r.gaps.filter((g) => g.booked > 0).length, 0),
    [rows],
  );

  const openReview = (c: GapClass) => {
    // Dates parents have booked are pre-ticked — those are the urgent ones.
    setTicked(new Set(c.gaps.filter((g) => g.booked > 0).map((g) => g.date)));
    setReview(c);
  };

  const addDates = async () => {
    if (!review) return;
    const dates = review.gaps.map((g) => g.date).filter((d) => ticked.has(d));
    if (dates.length === 0) { setReview(null); return; }
    setAdding(true);
    const { data: inserted, error } = await supabase
      .from("class_sessions")
      .insert(dates.map((session_date) => ({
        class_id: review.id,
        session_date,
        start_time: review.start_time,
        end_time: review.end_time,
        instructor_id: review.instructor_id,
        status: "scheduled",
      })))
      .select("id");
    if (error) { setAdding(false); toast.error(error.message); return; }

    // Mirror the class wizard so the class's teachers see these on their
    // "My classes" and registers straight away.
    const { data: teachers } = await supabase
      .from("class_instructors")
      .select("staff_id")
      .eq("class_id", review.id);
    const staffIds = ((teachers as { staff_id: string }[]) ?? []).map((t) => t.staff_id);
    if (staffIds.length > 0 && inserted && inserted.length > 0) {
      await supabase.from("session_instructors").insert(
        inserted.flatMap((s) => staffIds.map((staff_id) => ({ session_id: s.id, staff_id }))),
      );
    }
    setAdding(false);
    toast.success(`Added ${dates.length} date${dates.length === 1 ? "" : "s"} to ${review.name}`);
    setReview(null);
    void load();
  };

  if (rows === null) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-2 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking every class has its dates…
      </p>
    );
  }

  const reviewTicked = review ? review.gaps.filter((g) => ticked.has(g.date)).length : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Upcoming weekdays inside a class's term with no session on the timetable. Parents can only book dates that exist here.
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setRows(null); void load(); }}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-emerald-500 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-4 w-4" /> Every class has a session on each of its weekdays through the term.
        </p>
      ) : (
        <>
          {bookedGapCount > 0 && (
            <p className="text-sm flex items-center gap-2 rounded-lg border border-pink-500/40 bg-pink-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-pink-400 flex-shrink-0" />
              <span>
                <strong>{bookedGapCount}</strong> missing date{bookedGapCount === 1 ? " has" : "s have"} parents booked on{" "}
                {bookedGapCount === 1 ? "it" : "them"} — put the date back, or move their bookings (Bookings → Move).
              </span>
            </p>
          )}
          <div className="space-y-1.5">
            {rows.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                    {c.class_type === "children" ? "Children" : "Adults"}
                  </Badge>
                  {c.venue && <span className="ml-2 text-xs text-muted-foreground">{c.venue}</span>}
                  <span className="mt-1 flex flex-wrap gap-1">
                    {c.gaps.map((g) => (
                      <span
                        key={g.date}
                        className={`text-[11px] rounded px-1.5 py-0.5 border ${
                          g.booked > 0
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-500 font-medium"
                            : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {format(parseISO(g.date), "EEE d MMM")}
                        {g.booked > 0 && ` · ${g.booked} booked`}
                      </span>
                    ))}
                  </span>
                </div>
                <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => openReview(c)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Add dates
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!review} onOpenChange={(o) => { if (!o && !adding) setReview(null); }}>
        <DialogContent className="max-w-md max-h-dialog flex flex-col">
          <DialogHeader>
            <DialogTitle>Add dates to {review?.name}</DialogTitle>
            <DialogDescription>
              Tick the dates this class really runs on. Each becomes a {review?.start_time?.slice(0, 5)}–{review?.end_time?.slice(0, 5)} session
              parents can book. Leave a date unticked if the class genuinely isn't on — but move any booked dancers first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 overflow-y-auto pr-1">
            {review?.gaps.map((g) => (
              <label
                key={g.date}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer ${
                  g.booked > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 hover:border-border"
                }`}
              >
                <Checkbox
                  checked={ticked.has(g.date)}
                  onCheckedChange={(v) =>
                    setTicked((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(g.date); else next.delete(g.date);
                      return next;
                    })}
                />
                <span className="flex-1">{format(parseISO(g.date), "EEEE d MMMM yyyy")}</span>
                {g.booked > 0 && (
                  <span className="text-[11px] text-amber-500 font-medium">
                    {g.booked} dancer{g.booked === 1 ? "" : "s"} booked
                  </span>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={adding} onClick={() => setReview(null)}>Cancel</Button>
            <Button disabled={adding || reviewTicked === 0} onClick={addDates}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              {adding ? "Adding…" : `Add ${reviewTicked} date${reviewTicked === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimetableGaps;
