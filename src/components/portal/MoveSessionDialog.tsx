import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ADULT_CANCELLATION_INFO, sessionPrice } from "@/lib/pricing";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { OptionRow } from "@/components/booking/OptionRow";
import { OptionRowsSkeleton } from "@/components/booking/PortalSkeletons";
import { QuietNotice } from "@/components/booking/QuietNotice";
import { formatDay, formatPrice, formatTimeRange } from "@/lib/bookingFormat";

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
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}
      title="Move session"
      description={
        <>
          {booking.className}
          {booking.studentName && <> · for {booking.studentName}</>}
          {" · currently "}
          {format(parseISO(booking.sessionDate), "EEE d MMM yyyy")}
        </>
      }
      themeClass="portal-ui"
      footer={
        <div className="flex gap-2">
          <Button variant="soft" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button className="h-12 flex-1 rounded-xl" onClick={handleMove} disabled={!selectedSessionId || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Move session
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <QuietNotice>{ADULT_CANCELLATION_INFO}</QuietNotice>

        {!isTrial && (
          loadingClasses ? (
            <OptionRowsSkeleton rows={3} />
          ) : classes.length > 1 ? (
            <div>
              <p className="mb-2 text-[13px] font-medium text-foreground">Move to class</p>
              <div role="radiogroup" aria-label="Move to class" className="space-y-2">
                {classes.map((c) => (
                  <OptionRow
                    key={c.id}
                    selected={selectedClassId === c.id}
                    onSelect={() => setSelectedClassId(c.id)}
                    title={
                      <>
                        {c.name}
                        {c.id === booking.classId && (
                          <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">(current)</span>
                        )}
                      </>
                    }
                    meta={[
                      c.day_of_week ? formatDay(c.day_of_week, "plural") : null,
                      c.start_time ? formatTimeRange(c.start_time, c.end_time) : null,
                      c.venues?.name ?? null,
                    ].filter(Boolean).join(" · ")}
                    trailing={
                      <>
                        {formatPrice(priceOf(c), { trimZeros: true })}
                        <span className="text-[13px] font-normal text-muted-foreground">/class</span>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          ) : null
        )}

        {loadingSessions ? (
          <OptionRowsSkeleton rows={4} />
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-muted-foreground">
            No dates are available to move to{isTrial ? " for this class" : ""}.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground">Pick the new date</p>
            <div role="radiogroup" aria-label="Pick the new date" className="space-y-2">
              {sessions.map((s) => (
                <OptionRow
                  key={s.id}
                  name={`move-session-${booking.id}`}
                  selected={selectedSessionId === s.id}
                  onSelect={() => setSelectedSessionId(s.id)}
                  title={format(parseISO(s.session_date), "EEEE d MMMM yyyy")}
                  trailing={<span className="text-[13px] font-medium text-muted-foreground">{formatTimeRange(s.start_time, s.end_time)}</span>}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
};

export default MoveSessionDialog;
