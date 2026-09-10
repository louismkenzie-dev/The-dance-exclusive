import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePassCatalog } from "@/lib/passCatalog";
import { passCoverageLabel, passCoversClass } from "@/lib/passEligibility";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { Chip, ChipRow } from "@/components/booking/Chips";
import { OptionRow } from "@/components/booking/OptionRow";
import { formatTimeRange } from "@/lib/bookingFormat";

export interface SessionOption {
  id: string;
  classId: string;
  className: string;
  session_date: string;
  start_time: string;
  end_time: string;
  venueName: string | null;
}

interface PassRedeemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "pass" | "birthday";
  /** The pass being redeemed (ignored for the birthday mode). */
  pass?: { id: string; pass_type: string; sessions_remaining: number } | null;
  /** Upcoming sessions of the bookable adult classes, flattened across classes. */
  sessionOptions: SessionOption[];
  /** Called after a successful redemption so callers can refetch passes/bookings. */
  onRedeemed?: () => void;
}

const SESSION_DATE_RE = /session (\d{4}-\d{2}-\d{2})/;

/** Session picker for redeeming a multi-class pass or the free birthday class.
 *  Bookings made here are created with NO payment — credits cover them. */
export function PassRedeemDialog({
  open,
  onOpenChange,
  mode,
  pass,
  sessionOptions,
  onRedeemed,
}: PassRedeemDialogProps) {
  const { user } = useAuth();
  const { passes: catalog } = usePassCatalog();
  const [selSessions, setSelSessions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  // "classId|date" keys of sessions the user is already booked into — shown
  // green/faded so they can't re-book the same session.
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());

  // Start each redemption with a clean selection and fresh booked state.
  useEffect(() => {
    if (!open) return;
    setSelSessions([]);
    setVenueFilter("all");
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("class_id, notes")
        .eq("parent_id", user.id)
        .in("status", ["confirmed", "pending_payment"]);
      const keys = new Set<string>();
      for (const b of data ?? []) {
        const m = SESSION_DATE_RE.exec((b as any).notes || "");
        if (m && (b as any).class_id) keys.add(`${(b as any).class_id}|${m[1]}`);
      }
      setBookedKeys(keys);
    })();
  }, [open, user]);

  const maxSelectable = mode === "birthday" ? 1 : pass?.sessions_remaining ?? 0;

  const toggleSession = (id: string) => {
    setSelSessions((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (mode === "birthday") return [id];
      if (prev.length >= maxSelectable) {
        toast.info(`This pass covers ${maxSelectable} more class${maxSelectable === 1 ? "" : "es"}`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const submitRedemption = async () => {
    if (selSessions.length === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-pass", {
        body: {
          mode,
          passId: pass?.id,
          sessionIds: selSessions,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || data?.error) {
        toast.error("Could not book", { description: message || "Please try again" });
      } else {
        toast.success(
          mode === "birthday"
            ? "Birthday class booked — enjoy!"
            : `Booked ${data.booked} class${data.booked === 1 ? "" : "es"} with your pass`,
          data?.remaining != null
            ? { description: `${data.remaining} class${data.remaining === 1 ? "" : "es"} left on this pass` }
            : undefined,
        );
        onOpenChange(false);
        onRedeemed?.();
      }
    } catch (e: any) {
      toast.error("Could not book", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  // A pass can be limited to certain class lengths or classes (a 4-class pass
  // priced at 4 x £10 shouldn't buy £12 classes). Only offer what it covers —
  // the redeem function enforces the same rule server-side. The birthday
  // class is unrestricted.
  const passDef = mode === "pass" && pass
    ? catalog.find((p) => p.code === pass.pass_type)
    : undefined;
  const eligible = useMemo(() => {
    if (!passDef) return sessionOptions;
    return sessionOptions.filter((s) =>
      passCoversClass(
        { durations: passDef.durations, classIds: passDef.classIds },
        { id: s.classId, start_time: s.start_time, end_time: s.end_time },
      ));
  }, [sessionOptions, passDef]);

  const venues = useMemo(
    () =>
      ([...new Set(eligible.map((s) => s.venueName).filter(Boolean))] as string[]).sort((a, b) =>
        a.localeCompare(b),
      ),
    [eligible],
  );

  const upcoming = useMemo(
    () =>
      [...eligible]
        .filter((s) => venueFilter === "all" || s.venueName === venueFilter)
        .sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [eligible, venueFilter],
  );

  // Told plainly, so "where are my classes?" never becomes a support message.
  const coverageNote = passDef && (passDef.durations.length > 0 || passDef.classIds.length > 0)
    ? `This pass covers ${passCoverageLabel({ durations: passDef.durations, classIds: passDef.classIds })}.`
    : null;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "birthday" ? "Your free birthday class" : "Book with your pass"}
      description={
        mode === "birthday"
          ? "Pick any one adult class."
          : `Pick up to ${maxSelectable} class${maxSelectable === 1 ? "" : "es"}.`
      }
      themeClass="portal-ui"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-muted-foreground">
            {selSessions.length} selected
          </span>
          <Button
            className="h-12 rounded-xl px-6"
            disabled={selSessions.length === 0 || submitting}
            onClick={submitRedemption}
          >
            {submitting ? "Booking…" : mode === "birthday" ? "Book free class" : "Confirm booking"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {venues.length > 1 && (
          <ChipRow>
            <Chip selected={venueFilter === "all"} onClick={() => setVenueFilter("all")}>All venues</Chip>
            {venues.map((v) => (
              <Chip key={v} selected={venueFilter === v} onClick={() => setVenueFilter(v)}>{v}</Chip>
            ))}
          </ChipRow>
        )}

        {coverageNote && (
          <p className="text-[13px] text-muted-foreground">{coverageNote}</p>
        )}

        {upcoming.length === 0 && (
          <p className="py-8 text-center text-[15px] text-muted-foreground">
            {venueFilter !== "all"
              ? "No upcoming classes at this venue."
              : coverageNote
                ? "No upcoming classes this pass covers right now."
                : "No upcoming adult classes right now."}
          </p>
        )}

        {upcoming.length > 0 && (
          <div role="group" aria-label="Choose classes" className="space-y-2">
            {upcoming.map((s) => {
              const isBooked = bookedKeys.has(`${s.classId}|${s.session_date}`);
              const isSel = selSessions.includes(s.id);
              const meta = `${format(parseISO(s.session_date), "EEE d MMM")} · ${formatTimeRange(s.start_time, s.end_time)}${s.venueName ? ` · ${s.venueName}` : ""}`;
              return (
                <OptionRow
                  key={s.id}
                  control={mode === "birthday" ? "radio" : "checkbox"}
                  selected={isSel}
                  onSelect={() => toggleSession(s.id)}
                  disabled={isBooked}
                  status={isBooked ? "Booked" : undefined}
                  title={s.className}
                  meta={meta}
                />
              );
            })}
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
