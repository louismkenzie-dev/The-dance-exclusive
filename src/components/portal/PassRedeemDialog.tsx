import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

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
  const [selSessions, setSelSessions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Start each redemption with a clean selection.
  useEffect(() => {
    if (open) setSelSessions([]);
  }, [open]);

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

  const upcoming = useMemo(
    () => [...sessionOptions].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessionOptions],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-display">
            {mode === "birthday" ? "Your Free Birthday Class" : "Book With Your Pass"}
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground">
            {mode === "birthday"
              ? "Pick any one adult class"
              : `Pick up to ${maxSelectable} class${maxSelectable === 1 ? "" : "es"}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-1.5">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No upcoming adult classes right now.</p>
          )}
          {upcoming.map((s) => {
            const isSel = selSessions.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm transition-all cursor-pointer ${
                  isSel
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/50 bg-background/50 hover:border-border"
                }`}
              >
                <input
                  type={mode === "birthday" ? "radio" : "checkbox"}
                  checked={isSel}
                  onChange={() => toggleSession(s.id)}
                  className="rounded border-border accent-primary w-4 h-4"
                />
                <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-foreground font-medium truncate">{s.className}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {format(parseISO(s.session_date), "EEE d MMM")} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                    {s.venueName ? ` · ${s.venueName}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="border-t border-border/50 px-6 py-4 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {selSessions.length} selected
          </span>
          <Button
            disabled={selSessions.length === 0 || submitting}
            onClick={submitRedemption}
            className="uppercase tracking-wider text-xs font-semibold"
          >
            {submitting ? "Booking…" : mode === "birthday" ? "Book Free Class" : "Confirm Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
