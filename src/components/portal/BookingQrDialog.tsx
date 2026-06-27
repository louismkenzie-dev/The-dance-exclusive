import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateBookingQrToken, buildQrPayload } from "@/lib/qrTokens";
import { format } from "date-fns";
import { Loader2, ShieldCheck, Calendar as CalendarIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any | null;
}

const BookingQrDialog = ({ open, onOpenChange, booking }: Props) => {
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [token, setToken] = useState<{ token: string; validUntil: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const [qrSize, setQrSize] = useState(220);

  // Resize the QR to always fit inside its card on any viewport — guards
  // against narrow phones (320px) where a fixed 220px QR + card padding
  // overflows the dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const el = qrWrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setQrSize(Math.max(140, Math.min(240, Math.floor(w))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open, token?.token]);

  useEffect(() => {
    if (!open || !booking) return;
    void load();
  }, [open, booking?.id]);

  const load = async () => {
    setLoading(true);
    setToken(null);
    setUpcomingSessions([]);

    const todayIso = new Date().toISOString().split("T")[0];
    const [{ data: sessionsData }, t] = await Promise.all([
      supabase
      .from("class_sessions")
      .select("id, session_date, start_time, end_time, status")
      .eq("class_id", booking.class_id)
      .gte("session_date", todayIso)
      .neq("status", "cancelled")
      .order("session_date")
        .limit(20),
      getOrCreateBookingQrToken({
        bookingId: booking.id,
        studentId: booking.student_id ?? null,
      }),
    ]);

    setUpcomingSessions(sessionsData ?? []);
    setToken(t);
    setLoading(false);
  };

  const studentName = booking?.students
    ? `${booking.students.first_name} ${booking.students.last_name}`
    : booking?.classes?.name;
  const className = booking?.classes?.name;
  const nextSession = upcomingSessions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-md w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Sign-in QR Code
          </DialogTitle>
          <DialogDescription>
            Show this QR code at drop-off and pick-up. Anyone collecting your child must present this code for safeguarding.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !token ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Couldn't generate a QR code for this booking.</p>
        ) : (
          <div className="space-y-4">
            <Card className="p-4 sm:p-6 flex flex-col items-center gap-4 bg-white w-full">
              <div
                ref={qrWrapRef}
                className="w-full max-w-[240px] aspect-square flex items-center justify-center"
              >
                <QRCodeSVG
                  value={buildQrPayload(token.token)}
                  size={qrSize}
                  level="M"
                  includeMargin
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">{studentName}</p>
                {className && <p className="text-xs text-muted-foreground">{className}</p>}
                {nextSession && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 pt-1">
                    <CalendarIcon className="w-3 h-3" />
                    Next: {format(new Date(nextSession.session_date), "EEE d MMM")} · {nextSession.start_time?.slice(0, 5)}
                  </p>
                )}
              </div>
            </Card>

            <p className="text-[11px] text-muted-foreground text-center px-2">
              One QR code for the entire booking — use the same code at every drop-off and pick-up. Save it to your phone or take a screenshot.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingQrDialog;