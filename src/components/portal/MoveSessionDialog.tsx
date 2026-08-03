import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ADULT_CANCELLATION_INFO, sessionPrice } from "@/lib/pricing";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface CandidateClass {
  id: string;
  name: string;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  price_per_session: number | null;
  class_type: "children" | "adult";
  venues: { name: string } | null;
}

interface MoveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    classId: string;
    className: string;
    bookingType: string;       // 'trial' | 'session' | 'drop_in'
    sessionDate: string;       // YYYY-MM-DD (parsed from notes by the caller)
    classType: "children" | "adult";
    studentName?: string | null;
  } | null;
  onMoved: () => void;         // caller refetches
}

const CLASS_SELECT =
  "id, name, day_of_week, start_time, end_time, price_per_session, class_type, venues(name)";

const DAY_ORDER: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

const priceOf = (c: CandidateClass) =>
  sessionPrice({ ...c, price_per_term: null, price_per_month: null, price_per_year: null });

// Local-time approximation of the server's London-time 24h rule — the server
// re-checks authoritatively on submit.
const startsAtLeast24hAway = (s: SessionRow) => {
  const start = new Date(`${s.session_date}T${(s.start_time ?? "00:00").slice(0, 5)}:00`);
  return start.getTime() - Date.now() >= 24 * 60 * 60 * 1000;
};

const MoveSessionDialog = ({ open, onOpenChange, booking, onMoved }: MoveSessionDialogProps) => {
  const [classes, setClasses] = useState<CandidateClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isTrial = booking?.bookingType === "trial";

  // On open: trials stay within their class; PAYG can also pick another
  // bookable class of the same type at the same per-session price.
  useEffect(() => {
    if (!open || !booking) return;
    setSelectedClassId(booking.classId);
    setSelectedSessionId(null);
    if (booking.bookingType === "trial") {
      setClasses([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingClasses(true);
      const [classesRes, sourceRes] = await Promise.all([
        supabase
          .from("classes")
          .select(CLASS_SELECT)
          .eq("class_type", booking.classType)
          .eq("is_active", true)
          .eq("status", "confirmed")
          .eq("publicly_visible", true)
          .eq("booking_enabled", true)
          .eq("invite_only", false),
        supabase
          .from("classes")
          .select(CLASS_SELECT)
          .eq("id", booking.classId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const all = (classesRes.data as unknown as CandidateClass[]) ?? [];
      const source = (sourceRes.data as unknown as CandidateClass | null) ?? null;
      const sourcePrice = source ? priceOf(source) : null;
      // Mirror the server's price rule so no dead-end options are offered.
      const candidates = all
        .filter((c) => sourcePrice == null || priceOf(c) === sourcePrice)
        .sort((a, b) =>
          (DAY_ORDER[a.day_of_week ?? ""] ?? 7) - (DAY_ORDER[b.day_of_week ?? ""] ?? 7) ||
          (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
          a.name.localeCompare(b.name),
        );
      setClasses(candidates);
      setLoadingClasses(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [open, booking]);

  // Upcoming sessions of the chosen class, at least 24h out, minus the
  // session the booking already holds.
  useEffect(() => {
    if (!open || !booking || !selectedClassId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingSessions(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, status")
        .eq("class_id", selectedClassId)
        .gte("session_date", today)
        .order("session_date", { ascending: true });
      if (cancelled) return;
      const offered = ((data as SessionRow[]) ?? []).filter((s) =>
        s.status === "scheduled" &&
        startsAtLeast24hAway(s) &&
        !(selectedClassId === booking.classId && s.session_date === booking.sessionDate),
      );
      setSessions(offered);
      setSelectedSessionId(null);
      setLoadingSessions(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [open, selectedClassId, booking]);

  if (!booking) return null;

  const handleMove = async () => {
    if (!selectedSessionId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("move-booking-session", {
        body: { bookingId: booking.id, targetSessionId: selectedSessionId },
      });
      // supabase-js hides the function's JSON body behind error.context —
      // surface the server's friendly message instead of the generic one.
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || data?.error) {
        toast.error("Could not move the session", { description: message || "Please try again" });
      } else {
        toast.success("Session moved", {
          description: `${data.className} — ${format(parseISO(data.sessionDate), "EEE d MMM yyyy")}${data.startTime ? ` at ${String(data.startTime).slice(0, 5)}` : ""}`,
        });
        onOpenChange(false);
        onMoved();
      }
    } catch (e: any) {
      toast.error("Could not move the session", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-display">Move session</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {booking.className} {booking.studentName && <>· for {booking.studentName}</>} · currently{" "}
            {format(parseISO(booking.sessionDate), "EEE d MMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
            {ADULT_CANCELLATION_INFO}
          </p>

          {!isTrial && (
            loadingClasses ? (
              <div className="text-sm text-muted-foreground text-center py-6">Loading classes...</div>
            ) : classes.length > 1 ? (
              <>
                <p className="text-[11px] text-muted-foreground font-medium">Move to class:</p>
                <div className="grid gap-1.5">
                  {classes.map((c) => {
                    const isSel = selectedClassId === c.id;
                    const day = c.day_of_week ? c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1) : null;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClassId(c.id)}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          isSel
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border/50 bg-background/50 hover:border-border"
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground block truncate">
                            {c.name}
                            {c.id === booking.classId && (
                              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(current)</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                            {day && <span>{day}s</span>}
                            {c.start_time && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {c.start_time.slice(0, 5)}{c.end_time ? `–${c.end_time.slice(0, 5)}` : ""}
                              </span>
                            )}
                            {c.venues?.name && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {c.venues.name}
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-foreground whitespace-nowrap flex-shrink-0">
                          £{priceOf(c).toFixed(2).replace(/\.00$/, "")}
                          <span className="text-[10px] font-normal text-muted-foreground">/class</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null
          )}

          {loadingSessions ? (
            <div className="text-sm text-muted-foreground text-center py-6">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No dates are available to move to{isTrial ? " for this class" : ""}.
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground font-medium">Pick the new date:</p>
              <div className="grid gap-1.5">
                {sessions.map((s) => {
                  const isSel = selectedSessionId === s.id;
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                        isSel ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 bg-background/50 hover:border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`move-session-${booking.id}`}
                        checked={isSel}
                        onChange={() => setSelectedSessionId(s.id)}
                        className="accent-primary w-4 h-4"
                      />
                      <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="flex-1 text-foreground font-medium">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                      <span className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleMove} disabled={!selectedSessionId || submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Move session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveSessionDialog;
