import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateBookingQrToken, buildQrPayload } from "@/lib/qrTokens";
import { format } from "date-fns";
import { Loader2, ShieldCheck, Calendar as CalendarIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FadeRise } from "@/components/motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any | null;
}

const BookingQrDialog = ({ open, onOpenChange, booking }: Props) => {
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [token, setToken] = useState<{ token: string; validUntil: string } | null>(null);
  const [covered, setCovered] = useState<string[]>([]);
  const [familyPin, setFamilyPin] = useState<string | null>(null);
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
    setCovered([]);
    setFamilyPin(null);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;

    const todayIso = new Date().toISOString().split("T")[0];
    const [{ data: sessionsData }, t, { data: siblings }, { data: me }] = await Promise.all([
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
      // One scan covers EVERYONE this parent booked on the class.
      userId
        ? supabase
            .from("bookings")
            .select("id, students:student_id ( first_name, last_name, is_self )")
            .eq("class_id", booking.class_id)
            .eq("parent_id", userId)
            .eq("status", "confirmed")
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("profiles").select("pickup_pin").eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setUpcomingSessions(sessionsData ?? []);
    setToken(t);
    setCovered(
      ((siblings as any[]) ?? [])
        .map((b: any) =>
          b.students
            ? `${b.students.first_name} ${b.students.last_name}${b.students.is_self ? " (you)" : ""}`
            : null,
        )
        .filter(Boolean) as string[],
    );
    setFamilyPin((me as any)?.pickup_pin ?? null);
    setLoading(false);
  };

  const studentName = booking?.students
    ? `${booking.students.first_name} ${booking.students.last_name}`
    : booking?.classes?.name;
  const className = booking?.classes?.name;
  const nextSession = upcomingSessions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader className="space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary sm:mx-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle>Sign-in QR code</DialogTitle>
          <DialogDescription>
            Show this QR code at drop-off and pick-up. Anyone collecting your child must present this code for safeguarding.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !token ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Couldn't generate a QR code for this booking.</p>
        ) : (
          <FadeRise className="space-y-4">
            {/* QR card is deliberately always white for scannability, in both themes. */}
            <Card className="flex w-full flex-col items-center gap-4 bg-white p-4 sm:p-6">
              <div
                ref={qrWrapRef}
                className="flex aspect-square w-full max-w-[240px] items-center justify-center"
              >
                <QRCodeSVG
                  value={buildQrPayload(token.token)}
                  size={qrSize}
                  level="M"
                  includeMargin
                />
              </div>
              <div className="space-y-1 text-center">
                {/* Card is always white — force dark text so it's readable in dark mode too. */}
                <p className="font-display font-semibold text-black">
                  {covered.length > 1 ? covered.join(" · ") : studentName}
                </p>
                {className && <p className="text-xs text-gray-600">{className}</p>}
                {covered.length > 1 && (
                  <p className="text-[11px] text-gray-600">
                    One scan covers all {covered.length} — staff mark each person in individually.
                  </p>
                )}
                {nextSession && (
                  <p className="flex items-center justify-center gap-1 pt-1 text-xs text-gray-600">
                    <CalendarIcon className="h-3 w-3" />
                    Next: {format(new Date(nextSession.session_date), "EEE d MMM")} · {nextSession.start_time?.slice(0, 5)}
                  </p>
                )}
              </div>
            </Card>

            <p className="px-2 text-center text-[11px] text-muted-foreground">
              One QR code covers everyone you've booked on this class — use the same code at every
              drop-off and pick-up. Save it to your phone or take a screenshot.
            </p>

            {familyPin && (
              <div className="rounded-2xl bg-primary/8 p-4 text-center">
                <p className="eyebrow">No phone or QR? Your family PIN</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums tracking-[0.35em]">{familyPin}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Quote this 4-digit PIN to a member of staff and they can sign
                  {covered.length > 1 ? " everyone" : ""} in without the code. Keep it private —
                  anyone collecting on your behalf will need it.
                </p>
              </div>
            )}
          </FadeRise>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingQrDialog;
