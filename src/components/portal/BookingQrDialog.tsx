import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateBookingQrToken, buildQrPayload } from "@/lib/qrTokens";
import { format } from "date-fns";
import { formatTime } from "@/lib/bookingFormat";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { Bone } from "@/components/booking/Skeletons";

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
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sign-in QR code"
      description="Show this at drop-off and pick-up. Anyone collecting your child must present it."
      themeClass="portal-ui"
    >
      {loading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border p-5">
            <Bone className="mx-auto aspect-square w-full max-w-[240px] rounded-xl" />
            <Bone className="mx-auto mt-4 h-4 w-1/2" />
            <Bone className="mx-auto mt-2 h-3 w-1/3" />
          </div>
          <Bone className="mx-auto h-3 w-3/4" />
        </div>
      ) : !token ? (
        <p className="py-8 text-center text-[15px] text-muted-foreground">Couldn't generate a QR code for this booking.</p>
      ) : (
        <div className="space-y-4">
          {/* The QR panel is always white so it scans reliably in the dark
              adult theme too — the one deliberately fixed colour here. */}
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
            <div ref={qrWrapRef} className="flex aspect-square w-full max-w-[240px] items-center justify-center">
              <QRCodeSVG value={buildQrPayload(token.token)} size={qrSize} level="M" includeMargin />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[17px] font-semibold tracking-tight text-neutral-900">
                {covered.length > 1 ? covered.join(" · ") : studentName}
              </p>
              {className && <p className="text-[13px] text-neutral-600">{className}</p>}
              {covered.length > 1 && (
                <p className="text-[13px] text-neutral-600">
                  One scan covers all {covered.length} — staff mark each person in individually.
                </p>
              )}
              {nextSession && (
                <p className="pt-1 text-[13px] text-neutral-600">
                  Next: {format(new Date(nextSession.session_date), "EEE d MMM")} · {formatTime(nextSession.start_time)}
                </p>
              )}
            </div>
          </div>

          <p className="px-2 text-center text-[13px] leading-relaxed text-muted-foreground">
            One QR code covers everyone you've booked on this class — use the same code at every
            drop-off and pick-up. Save it to your phone or take a screenshot.
          </p>

          {familyPin && (
            <div className="rounded-2xl bg-muted/60 p-4 text-center">
              <p className="text-[13px] font-medium text-muted-foreground">No phone or QR? Your family PIN</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.35em] text-foreground">{familyPin}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Quote this 4-digit PIN to a member of staff and they can sign
                {covered.length > 1 ? " everyone" : ""} in without the code. Keep it private —
                anyone collecting on your behalf will need it.
              </p>
            </div>
          )}
        </div>
      )}
    </ResponsiveSheet>
  );
};

export default BookingQrDialog;
