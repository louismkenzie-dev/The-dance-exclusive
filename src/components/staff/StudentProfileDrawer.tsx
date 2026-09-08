import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, AlertTriangle, Heart, User, Camera, Sparkles, Users, LogIn, LogOut, XCircle, QrCode, RotateCcw, Star } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { getOrCreateBookingQrToken, buildQrPayload } from "@/lib/qrTokens";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import { initialsOf } from "@/lib/initials";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { arrivalOpensLabel, arrivalsOpen, registerState } from "@/lib/registerRules";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  studentId: string | null;
  booking?: any | null;
  sessionId?: string | null;
  classId?: string | null;
  /** The session's date and start, for the 15-minute arrival rule. */
  sessionDate?: string | null;
  sessionStart?: string | null;
  /** "Mini Street · 17:00–17:45" */
  sessionLabel?: string | null;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onMarkAbsent?: () => void;
  onClearAttendance?: () => void;
  /** Dancer of the Week — stored on the session's attendance row. */
  onToggleDancerOfWeek?: () => void;
}

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: ReactNode }) => (
  <section className="space-y-2">
    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {title}
    </h4>
    <div className="text-[15px]">{children}</div>
  </section>
);

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between gap-3 py-1.5 text-[15px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium text-foreground">{value || "—"}</span>
  </div>
);

const Flag = ({ tone, children }: { tone: "danger" | "warning" | "quiet"; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
      tone === "danger" && "bg-destructive/15 text-[hsl(var(--destructive-strong))]",
      tone === "warning" && "bg-warning/15 text-[hsl(var(--warning-strong))]",
      tone === "quiet" && "bg-muted text-muted-foreground",
    )}
  >
    {children}
  </span>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="whitespace-pre-wrap rounded-xl bg-muted/60 px-3 py-2 text-[15px] leading-relaxed text-foreground">{children}</p>
);

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Everything the door team needs about one dancer, in a sheet: who they are,
 * what to know before they walk in, how to verify a collector, and the four
 * register actions under the thumb.
 */
const StudentProfileDrawer = ({
  open,
  onOpenChange,
  studentId,
  booking,
  sessionId,
  sessionDate,
  sessionStart,
  sessionLabel,
  onCheckIn,
  onCheckOut,
  onMarkAbsent,
  onClearAttendance,
  onToggleDancerOfWeek,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<any | null>(null);
  const [parent, setParent] = useState<any | null>(null);
  const [collectors, setCollectors] = useState<any[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [qrToken, setQrToken] = useState<{ token: string; validUntil: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!studentId) {
      // Legacy adult self-booking with no attendee profile: nothing to load,
      // but the marking actions must still be available.
      setLoading(false);
      setStudent(null);
      setParent(null);
      setCollectors([]);
      return;
    }
    void load();
  }, [open, studentId]);

  useEffect(() => {
    if (!open) { setShowQr(false); setQrToken(null); }
  }, [open]);

  const load = async () => {
    setLoading(true);
    setStudent(null);
    setParent(null);
    setCollectors([]);
    const { data: s } = await supabase.from("students").select("*").eq("id", studentId!).maybeSingle();
    setStudent(s);
    if (s?.parent_id) {
      // Staff-facing view is deliberately minimal: no parent contact details or
      // address — only the pickup PIN (needed to verify collectors) plus the
      // child's own emergency contact and authorised collectors.
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase
          .from("profiles")
          .select("pickup_pin")
          .eq("user_id", s.parent_id)
          .maybeSingle(),
        supabase
          .from("authorized_collectors")
          .select("name, relationship, phone, email")
          .eq("student_id", s.id),
      ]);
      setParent(p);
      setCollectors(c ?? []);
    }
    setLoading(false);
  };

  const age = student?.date_of_birth ? differenceInYears(new Date(), new Date(student.date_of_birth)) : null;
  const att = booking?.attendance;
  const state = registerState(att);
  const canArrive = sessionDate && sessionStart ? arrivalsOpen(sessionDate, sessionStart) : true;
  const opensLabel = sessionDate && sessionStart && !canArrive ? arrivalOpensLabel(sessionDate, sessionStart) : null;

  const openQr = async () => {
    if (!booking?.id) return;
    setShowQr(true);
    if (qrToken) return;
    setQrLoading(true);
    const t = await getOrCreateBookingQrToken({
      bookingId: booking.id,
      studentId: booking.student_id ?? null,
    });
    setQrToken(t);
    setQrLoading(false);
  };

  const bookingStudent = booking?.students;
  const title = student
    ? `${student.first_name} ${student.last_name}`
    : bookingStudent
      ? `${bookingStudent.first_name} ${bookingStudent.last_name}`
      : "Adult attendee";
  const description = student
    ? [student.preferred_name ? `"${student.preferred_name}"` : null, age != null ? `${age} years old` : "Age not on file", sessionLabel]
        .filter(Boolean)
        .join(" · ")
    : sessionLabel ?? "Booked before attendee profiles were required — no details on file.";

  const statusLine =
    state === "absent"
      ? "Marked absent"
      : state === "out"
        ? `In ${fmtTime(att.checked_in_at)} · Out ${fmtTime(att.checked_out_at)}${att.collector_name ? ` · ${att.collector_name}` : ""}`
        : state === "in"
          ? `Arrived ${fmtTime(att.checked_in_at)}${att.collector_name ? ` · dropped off by ${att.collector_name}` : ""}`
          : "Not marked yet";

  const hasActions = booking && (onCheckIn || onCheckOut || onMarkAbsent || onClearAttendance);

  const footer = hasActions ? (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {onCheckIn && (
          <Button
            type="button"
            onClick={onCheckIn}
            disabled={state === "in" || state === "out" || !canArrive}
            className="h-12 rounded-xl bg-success text-[15px] font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" /> Arrived
          </Button>
        )}
        {onCheckOut && (
          <Button
            type="button"
            onClick={onCheckOut}
            disabled={state !== "in"}
            className="h-12 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" /> Departed
          </Button>
        )}
        {onMarkAbsent && (
          <Button
            type="button"
            variant="soft"
            onClick={onMarkAbsent}
            disabled={state === "absent"}
            className="h-12 rounded-xl border-destructive/40 text-[15px] font-semibold text-[hsl(var(--destructive-strong))] hover:bg-destructive/10 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Absent
          </Button>
        )}
        {onClearAttendance && (
          <Button
            type="button"
            variant="soft"
            onClick={onClearAttendance}
            disabled={state === "unaccounted"}
            className="h-12 rounded-xl text-[15px] font-semibold disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
      {opensLabel && (
        <p className="mt-2 text-center text-[13px] text-warning">Arrivals {opensLabel.toLowerCase().replace(/^opens/, "open")}, 15 minutes before the class.</p>
      )}
    </div>
  ) : undefined;

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} description={description} footer={footer} size="md">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Who, and where they are on the register */}
          <div className="flex items-center gap-3">
            <PhotoAvatarDuo
              photoUrl={student?.profile_photo ?? bookingStudent?.profile_photo}
              avatarUrl={student?.avatar_url ?? bookingStudent?.avatar_url}
              initials={initialsOf(student?.first_name ?? bookingStudent?.first_name, student?.last_name ?? bookingStudent?.last_name)}
              size="md"
              photoPrimary
              expandable
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  state === "in" && "bg-success/15 text-[hsl(var(--success-strong))]",
                  state === "out" && "bg-primary/15 text-primary",
                  state === "absent" && "bg-destructive/15 text-[hsl(var(--destructive-strong))]",
                  state === "unaccounted" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "in" ? "In the room" : state === "out" ? "Departed" : state === "absent" ? "Absent" : "Not marked"}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{statusLine}</p>
            </div>
          </div>

          {student && (
            <>
              {/* Critical safeguarding flags */}
              {(student.has_epipen || student.has_inhaler || student.has_send || student.ehcp_in_place || student.one_to_one_required ||
                !student.is_toilet_trained || student.wears_nappies || student.prone_to_accidents || !student.photo_consent) && (
                <div className="flex flex-wrap gap-1.5">
                  {student.has_epipen && <Flag tone="danger">EpiPen</Flag>}
                  {student.has_inhaler && <Flag tone="danger">Inhaler</Flag>}
                  {student.has_send && <Flag tone="warning">SEND</Flag>}
                  {student.ehcp_in_place && <Flag tone="warning">EHCP</Flag>}
                  {student.one_to_one_required && <Flag tone="warning">1:1 required</Flag>}
                  {!student.is_toilet_trained && <Flag tone="quiet">Not toilet trained</Flag>}
                  {student.wears_nappies && <Flag tone="quiet">Wears nappies</Flag>}
                  {student.prone_to_accidents && <Flag tone="quiet">Prone to accidents</Flag>}
                  {!student.photo_consent && <Flag tone="quiet">No photo consent</Flag>}
                </div>
              )}

              {/* Medical */}
              {(student.allergies_list?.length > 0 || student.medical_conditions_list?.length > 0 || student.medical_info) && (
                <Section title="Medical & allergies" icon={Heart}>
                  {student.allergies_list?.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[13px] text-muted-foreground">Allergies</p>
                      <div className="flex flex-wrap gap-1">
                        {student.allergies_list.map((a: string) => <Flag key={a} tone="danger">{a}</Flag>)}
                      </div>
                    </div>
                  )}
                  {student.medical_conditions_list?.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[13px] text-muted-foreground">Conditions</p>
                      <div className="flex flex-wrap gap-1">
                        {student.medical_conditions_list.map((a: string) => <Flag key={a} tone="quiet">{a}</Flag>)}
                      </div>
                    </div>
                  )}
                  {student.medical_info && <Note>{student.medical_info}</Note>}
                </Section>
              )}

              {/* SEND */}
              {student.has_send && (student.send_conditions_list?.length > 0 || student.send_details) && (
                <Section title="SEND details" icon={Sparkles}>
                  {student.send_conditions_list?.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {student.send_conditions_list.map((a: string) => <Flag key={a} tone="quiet">{a}</Flag>)}
                    </div>
                  )}
                  {student.send_details && <Note>{student.send_details}</Note>}
                </Section>
              )}

              {/* Toileting */}
              {(student.toileting_notes || student.wears_nappies || !student.is_toilet_trained) && (
                <Section title="Toileting" icon={AlertTriangle}>
                  {student.toileting_notes ? <Note>{student.toileting_notes}</Note> : <p className="text-[15px] text-muted-foreground">See flags above.</p>}
                </Section>
              )}

              {/* Pickup verification — the Family PIN only; parent contact
                  details are deliberately not shown to staff */}
              {parent?.pickup_pin && (
                <Section title="Pickup verification" icon={User}>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[hsl(var(--warning-strong))]">No QR? Family PIN</span>
                      <span className="font-mono text-xl font-bold tracking-[0.3em] text-foreground">{parent.pickup_pin}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Ask a collector without a QR code for this PIN before signing out, and record their name when prompted.
                    </p>
                  </div>
                </Section>
              )}

              {/* Emergency */}
              {(student.emergency_contact_name || student.emergency_contact_phone) && (
                <Section title="Emergency contact" icon={Phone}>
                  <Row label="Name" value={student.emergency_contact_name} />
                  <Row
                    label="Phone"
                    value={
                      student.emergency_contact_phone ? (
                        <a href={`tel:${String(student.emergency_contact_phone).replace(/\s+/g, "")}`} className="text-primary underline-offset-4 hover:underline">
                          {student.emergency_contact_phone}
                        </a>
                      ) : null
                    }
                  />
                </Section>
              )}

              {/* Backup contact — who to try when the first one doesn't pick up */}
              {(student.emergency_contact_2_name || student.emergency_contact_2_phone) && (
                <Section title="Second emergency contact" icon={Phone}>
                  <Row label="Name" value={student.emergency_contact_2_name} />
                  <Row
                    label="Phone"
                    value={
                      student.emergency_contact_2_phone ? (
                        <a href={`tel:${String(student.emergency_contact_2_phone).replace(/\s+/g, "")}`} className="text-primary underline-offset-4 hover:underline">
                          {student.emergency_contact_2_phone}
                        </a>
                      ) : null
                    }
                  />
                  <Row label="Relationship" value={student.emergency_contact_2_relationship} />
                </Section>
              )}

              {/* Authorized collectors */}
              {collectors.length > 0 && (
                <Section title="Authorised collectors" icon={Users}>
                  <div className="space-y-2">
                    {collectors.map((c, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card px-3 py-2.5">
                        <p className="text-[15px] font-medium text-foreground">{c.name}</p>
                        <p className="text-[13px] text-muted-foreground">{[c.relationship, c.phone || c.email].filter(Boolean).join(" · ")}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Consent */}
              <Section title="Consent" icon={Camera}>
                <Row label="Photo & media" value={student.photo_consent ? "Yes" : "No"} />
              </Section>
            </>
          )}

          {/* Dancer of the Week — a tick on this session's register */}
          {booking && sessionId && onToggleDancerOfWeek && (
            <Button
              type="button"
              variant="soft"
              onClick={onToggleDancerOfWeek}
              className={cn("h-11 w-full rounded-xl", att?.dancer_of_week && "border-warning/50 bg-warning/10 text-[hsl(var(--warning-strong))]")}
            >
              <Star className={cn("h-4 w-4", att?.dancer_of_week && "fill-current")} />
              {att?.dancer_of_week ? "Dancer of the Week ⭐" : "Make Dancer of the Week"}
            </Button>
          )}

          {/* QR — for a parent who wants to photograph their code */}
          {booking && sessionId && (
            <div>
              {!showQr ? (
                <Button type="button" onClick={openQr} variant="soft" className="h-11 w-full rounded-xl">
                  <QrCode className="h-4 w-4" /> Show booking QR code
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4">
                  {qrLoading || !qrToken ? (
                    <div className="py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                  ) : (
                    <>
                      <QRCodeSVG value={buildQrPayload(qrToken.token)} size={180} level="M" includeMargin />
                      <p className="text-[12px] text-gray-600">Valid until {format(new Date(qrToken.validUntil), "d MMM HH:mm")}</p>
                      <p className="text-center text-[12px] text-gray-600">Show to the parent — they can photograph it for pickup.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ResponsiveSheet>
  );
};

export default StudentProfileDrawer;
