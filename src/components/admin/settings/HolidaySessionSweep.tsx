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
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";

/**
 * "Are any classes scheduled during a school holiday?" — with a safe bulk
 * fix. Class schedules generated before the holiday dates were entered can
 * quietly include half-term weeks; those dates then inflate "N sessions this
 * term" counts and start have-I-been-overcharged emails. This panel shows
 * every such session per holiday and deletes them in one go — per class, so
 * classes that deliberately run through the holidays can be left ticked off.
 * Sessions with a register entry or a booking pinned to the date are never
 * deleted from here.
 */

interface Holiday { id: string; name: string; start_date: string; end_date: string }

interface StraySession {
  id: string;
  class_id: string;
  session_date: string;
  className: string;
  classType: "children" | "adult";
  /** A register entry or date-pinned booking exists — hands off. */
  locked: boolean;
}

interface Props {
  holidays: Holiday[];
}

export const HolidaySessionSweep = ({ holidays }: Props) => {
  const [strays, setStrays] = useState<StraySession[] | null>(null);
  const [reviewHoliday, setReviewHoliday] = useState<Holiday | null>(null);
  const [tickedClasses, setTickedClasses] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (holidays.length === 0) { setStrays([]); return; }
    const ranges = holidays
      .map((h) => `and(session_date.gte.${h.start_date},session_date.lte.${h.end_date})`)
      .join(",");
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, class_id, session_date")
      .or(ranges)
      .neq("status", "cancelled");
    const rows = (sessions as { id: string; class_id: string; session_date: string }[]) ?? [];
    if (rows.length === 0) { setStrays([]); return; }

    const classIds = [...new Set(rows.map((s) => s.class_id))];
    const dates = [...new Set(rows.map((s) => s.session_date))];
    const [{ data: classes }, { data: attendance }, { data: pinned }] = await Promise.all([
      supabase.from("classes").select("id, name, class_type").in("id", classIds),
      supabase.from("attendance").select("class_session_id, class_id, session_date")
        .in("class_session_id", rows.map((s) => s.id)),
      supabase.from("bookings").select("class_id, notes")
        .in("class_id", classIds)
        .neq("status", "cancelled")
        .in("booking_type", ["trial", "session"]),
    ]);
    const classById = new Map(((classes as { id: string; name: string; class_type: "children" | "adult" }[]) ?? []).map((c) => [c.id, c]));
    const attended = new Set(((attendance as { class_session_id: string | null }[]) ?? [])
      .map((a) => a.class_session_id).filter(Boolean) as string[]);
    const pinnedKeys = new Set<string>();
    for (const b of ((pinned as { class_id: string; notes: string | null }[]) ?? [])) {
      for (const d of dates) {
        if (b.notes?.includes(`session ${d}`)) pinnedKeys.add(`${b.class_id}|${d}`);
      }
    }

    setStrays(rows
      .map((s) => {
        const cls = classById.get(s.class_id);
        return cls ? {
          ...s,
          className: cls.name,
          classType: cls.class_type,
          locked: attended.has(s.id) || pinnedKeys.has(`${s.class_id}|${s.session_date}`),
        } : null;
      })
      .filter(Boolean) as StraySession[]);
  }, [holidays]);
  useEffect(() => { void load(); }, [load]);

  const byHoliday = useMemo(() => {
    const map = new Map<string, StraySession[]>();
    for (const h of holidays) {
      const inRange = (strays ?? []).filter((s) => s.session_date >= h.start_date && s.session_date <= h.end_date);
      if (inRange.length > 0) map.set(h.id, inRange.sort((a, b) => a.session_date.localeCompare(b.session_date)));
    }
    return map;
  }, [strays, holidays]);

  const openReview = (h: Holiday) => {
    const inRange = byHoliday.get(h.id) ?? [];
    // Children's classes are pre-ticked for removal; adult classes often run
    // through the holidays, so they start unticked.
    setTickedClasses(new Set(inRange.filter((s) => s.classType === "children" && !s.locked).map((s) => s.class_id)));
    setReviewHoliday(h);
  };

  const doDelete = async () => {
    if (!reviewHoliday) return;
    const targets = (byHoliday.get(reviewHoliday.id) ?? [])
      .filter((s) => tickedClasses.has(s.class_id) && !s.locked);
    if (targets.length === 0) { setReviewHoliday(null); return; }
    setDeleting(true);
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .in("id", targets.map((s) => s.id));
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Removed ${targets.length} session${targets.length === 1 ? "" : "s"} from ${reviewHoliday.name}`);
    setReviewHoliday(null);
    void load();
  };

  if (strays === null) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-2 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for class sessions during holidays…
      </p>
    );
  }

  const reviewRows = reviewHoliday ? (byHoliday.get(reviewHoliday.id) ?? []) : [];
  // One row per class in the review dialog, its dates gathered up.
  const reviewClasses = [...new Map(reviewRows.map((s) => [s.class_id, s])).values()].map((s) => ({
    ...s,
    dates: reviewRows.filter((r) => r.class_id === s.class_id),
  }));
  const deletable = reviewRows.filter((s) => tickedClasses.has(s.class_id) && !s.locked).length;

  return (
    <div className="space-y-2">
      {byHoliday.size === 0 ? (
        <p className="text-sm text-emerald-500 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-4 w-4" /> No class sessions fall inside a school holiday — parents' session counts are clean.
        </p>
      ) : (
        holidays.filter((h) => byHoliday.has(h.id)).map((h) => {
          const rows = byHoliday.get(h.id)!;
          return (
            <div key={h.id} className="flex items-center justify-between rounded-lg border border-pink-500/40 bg-pink-500/5 p-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-pink-400 flex-shrink-0" />
                <span>
                  <strong>{rows.length}</strong> class session{rows.length === 1 ? "" : "s"} scheduled during{" "}
                  <strong>{h.name}</strong>
                  <span className="block text-xs text-muted-foreground">
                    These count towards parents' "sessions this term" — remove them unless the class really runs that week.
                  </span>
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => openReview(h)}>Review &amp; remove</Button>
            </div>
          );
        })
      )}

      <Dialog open={!!reviewHoliday} onOpenChange={(o) => { if (!o && !deleting) setReviewHoliday(null); }}>
        <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sessions during {reviewHoliday?.name}</DialogTitle>
            <DialogDescription>
              Untick any class that really does run through the holiday. Sessions with a register entry
              or a booking on that date can't be removed from here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 overflow-y-auto pr-1">
            {reviewClasses.map((c) => (
              <label
                key={c.class_id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-sm ${
                  c.locked ? "opacity-60 border-amber-500/40 bg-amber-500/5" : "cursor-pointer border-border/60 hover:border-border"
                }`}
              >
                <Checkbox
                  className="mt-0.5"
                  disabled={c.locked}
                  checked={tickedClasses.has(c.class_id) && !c.locked}
                  onCheckedChange={(v) =>
                    setTickedClasses((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(c.class_id); else next.delete(c.class_id);
                      return next;
                    })}
                />
                <span className="flex-1">
                  <span className="font-medium">{c.className}</span>
                  <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                    {c.classType === "children" ? "Children" : "Adults"}
                  </Badge>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {c.dates.map((d) => format(parseISO(d.session_date), "EEE d MMM")).join(" · ")}
                  </span>
                  {c.locked && (
                    <span className="block text-[11px] text-amber-500 mt-0.5">
                      Has a booking or register entry — sort that out first, then remove the date from the class itself.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setReviewHoliday(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting || deletable === 0} onClick={doDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {deleting ? "Removing…" : `Remove ${deletable} session${deletable === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidaySessionSweep;
