import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, AlertTriangle, Heart, Shield, User, Camera, Sparkles, Users, LogIn, LogOut, XCircle, QrCode, Cake, HelpCircle, Check } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { getOrCreateBookingQrToken, buildQrPayload } from "@/lib/qrTokens";
import { FadeRise } from "@/components/motion";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  studentId: string | null;
  booking?: any | null;
  sessionId?: string | null;
  classId?: string | null;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onMarkAbsent?: () => void;
  onClearAttendance?: () => void;
}

const Section = ({ title, icon: Icon, children }: any) => (
  <div className="space-y-2">
    <h4 className="eyebrow flex items-center gap-1.5">
      <Icon className="w-3 h-3" /> {title}
    </h4>
    <div className="text-sm">{children}</div>
  </div>
);

const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between gap-3 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "—"}</span>
  </div>
);

/** Current register status as a satisfying moment — tinted circle with a spring pop. */
const StatusMoment = ({ att }: { att: any }) => {
  const fmt = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const info = (() => {
    if (att?.status === "absent")
      return { key: "absent", tint: "bg-destructive/10 text-destructive", Icon: XCircle, label: "Absent", detail: "Marked absent for this session" };
    if (att?.checked_out_at)
      return { key: "out", tint: "bg-primary/10 text-primary", Icon: LogOut, label: "Departed", detail: `In ${fmt(att.checked_in_at)} · Out ${fmt(att.checked_out_at)}` };
    if (att?.checked_in_at)
      return { key: "in", tint: "bg-success/10 text-success", Icon: Check, label: "Arrived", detail: `Checked in ${fmt(att.checked_in_at)}` };
    return { key: "none", tint: "bg-secondary text-muted-foreground", Icon: HelpCircle, label: "Unaccounted", detail: "Not marked yet" };
  })();
  return (
    <FadeRise key={info.key} className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${info.tint}`}>
        <info.Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{info.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {info.detail}
          {att?.collector_name && <> · {att.collector_name}</>}
        </p>
      </div>
    </FadeRise>
  );
};

const StudentProfileDrawer = ({ open, onOpenChange, studentId, booking, sessionId, onCheckIn, onCheckOut, onMarkAbsent, onClearAttendance }: Props) => {
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
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, secondary_phone, address_line1, city, postcode, pickup_pin")
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
  const isIn = att?.checked_in_at && !att?.checked_out_at;
  const isOut = !!att?.checked_out_at;
  const isAbsent = att?.status === "absent";
  const isUnaccounted = !att || (!att.checked_in_at && !isAbsent);

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

  const markButtons = (
    <div className="grid grid-cols-2 gap-2">
      {onCheckIn && (
        <Button onClick={onCheckIn} disabled={!!isIn} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90 disabled:opacity-60">
          <LogIn className="w-4 h-4" /> Arrived
        </Button>
      )}
      {onCheckOut && (
        <Button onClick={onCheckOut} disabled={!isIn} className="gap-1.5 disabled:opacity-60">
          <LogOut className="w-4 h-4" /> Departed
        </Button>
      )}
      {onClearAttendance && (
        <Button variant="secondary" onClick={onClearAttendance} disabled={isUnaccounted} className="gap-1.5 disabled:opacity-60">
          <HelpCircle className="w-4 h-4" /> Unaccounted
        </Button>
      )}
      {onMarkAbsent && (
        <Button variant="destructive" onClick={onMarkAbsent} disabled={isAbsent} className="gap-1.5 disabled:opacity-60">
          <XCircle className="w-4 h-4" /> Absent
        </Button>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !student ? (
          // Legacy adult self-booking without an attendee profile — still allow marking.
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 shrink-0 rounded-full bg-secondary flex items-center justify-center text-lg font-display font-bold text-muted-foreground">A</div>
                <div>
                  <SheetTitle>Adult attendee</SheetTitle>
                  <SheetDescription>
                    Booked before attendee profiles were required — no age or medical details on file.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            {booking && (onCheckIn || onCheckOut || onMarkAbsent || onClearAttendance) && (
              <div className="space-y-3 pt-6 mt-6 border-t border-border/50">
                <h4 className="eyebrow">Mark as</h4>
                <StatusMoment att={att} />
                {markButtons}
              </div>
            )}
          </>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <PhotoAvatarDuo
                  photoUrl={student.profile_photo}
                  avatarUrl={student.avatar_url}
                  initials={student.first_name?.[0]}
                  size="md"
                />
                <div>
                  <SheetTitle>{student.first_name} {student.last_name}</SheetTitle>
                  <SheetDescription>
                    {student.preferred_name && <>"{student.preferred_name}" · </>}
                    {age != null && <>{age} years old · </>}
                    {student.gender || "—"}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* QR */}
            {booking && sessionId && (
              <div className="mt-4">
                <Button onClick={openQr} variant="secondary" className="gap-1.5 w-full">
                  <QrCode className="w-4 h-4" /> View booking QR code
                </Button>
              </div>
            )}

            {showQr && (
              /* Scannability surface — stays forced white in every theme. */
              <Card className="mt-4 p-4 bg-white flex flex-col items-center gap-2">
                {qrLoading || !qrToken ? (
                  <div className="py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <QRCodeSVG value={buildQrPayload(qrToken.token)} size={180} level="M" includeMargin />
                    <p className="text-[11px] text-gray-600">Valid until {format(new Date(qrToken.validUntil), "d MMM HH:mm")}</p>
                    <p className="text-[11px] text-gray-600 text-center">Show to parent — they can photograph it for pickup.</p>
                  </>
                )}
              </Card>
            )}

            {/* DOB / quick facts */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary/60 p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Cake className="w-3 h-3" /> Date of birth</div>
                <div className="font-medium text-sm mt-0.5">{student.date_of_birth ? format(new Date(student.date_of_birth), "d MMM yyyy") : "—"}</div>
              </div>
              <div className="rounded-2xl bg-secondary/60 p-3">
                <div className="text-[11px] text-muted-foreground">Ability</div>
                <div className="font-medium text-sm mt-0.5">{student.ability_level || "—"}</div>
              </div>
            </div>

            {/* Critical safeguarding flags */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {student.has_epipen && <Badge variant="destructive">EpiPen</Badge>}
              {student.has_inhaler && <Badge variant="destructive">Inhaler</Badge>}
              {student.has_send && <Badge variant="warning">SEND</Badge>}
              {student.ehcp_in_place && <Badge variant="warning">EHCP</Badge>}
              {student.one_to_one_required && <Badge variant="warning">1:1 required</Badge>}
              {!student.is_toilet_trained && <Badge variant="outline">Not toilet trained</Badge>}
              {student.wears_nappies && <Badge variant="outline">Wears nappies</Badge>}
              {student.prone_to_accidents && <Badge variant="outline">Prone to accidents</Badge>}
              {!student.photo_consent && <Badge variant="outline">No photo consent</Badge>}
            </div>

            <div className="mt-6 space-y-6">
              {/* Medical */}
              {(student.allergies_list?.length > 0 || student.medical_conditions_list?.length > 0 || student.medical_info) && (
                <Section title="Medical & allergies" icon={Heart}>
                  {student.allergies_list?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">Allergies</p>
                      <div className="flex flex-wrap gap-1">
                        {student.allergies_list.map((a: string) => <Badge key={a} variant="destructive" className="text-[10px]">{a}</Badge>)}
                      </div>
                    </div>
                  )}
                  {student.medical_conditions_list?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">Conditions</p>
                      <div className="flex flex-wrap gap-1">
                        {student.medical_conditions_list.map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
                      </div>
                    </div>
                  )}
                  {student.medical_info && <p className="text-sm rounded-2xl bg-secondary/60 p-3">{student.medical_info}</p>}
                </Section>
              )}

              {/* SEND */}
              {student.has_send && (student.send_conditions_list?.length > 0 || student.send_details) && (
                <Section title="SEND details" icon={Sparkles}>
                  {student.send_conditions_list?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {student.send_conditions_list.map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
                    </div>
                  )}
                  {student.send_details && <p className="text-sm rounded-2xl bg-secondary/60 p-3 whitespace-pre-wrap">{student.send_details}</p>}
                </Section>
              )}

              {/* Toileting */}
              {(student.toileting_notes || student.wears_nappies || !student.is_toilet_trained) && (
                <Section title="Toileting" icon={AlertTriangle}>
                  {student.toileting_notes && <p className="text-sm rounded-2xl bg-secondary/60 p-3">{student.toileting_notes}</p>}
                </Section>
              )}

              {/* Parent */}
              {parent && (
                <Section title="Parent / guardian" icon={User}>
                  <Row label="Name" value={parent.full_name} />
                  <Row label="Phone" value={parent.phone} />
                  {parent.secondary_phone && <Row label="Alt phone" value={parent.secondary_phone} />}
                  <Row label="Email" value={parent.email} />
                  {parent.address_line1 && (
                    <Row label="Address" value={`${parent.address_line1}, ${parent.city ?? ""} ${parent.postcode ?? ""}`} />
                  )}
                  {parent.pickup_pin && (
                    <div className="mt-2 rounded-2xl bg-warning/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-warning">No QR? Family PIN</span>
                        <span className="font-mono font-bold text-lg tracking-[0.3em]">{parent.pickup_pin}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        If the collector has no QR code, ask them for this 4-digit Family PIN before
                        signing in/out, and record their name when prompted.
                      </p>
                    </div>
                  )}
                </Section>
              )}

              {/* Emergency */}
              {(student.emergency_contact_name || student.emergency_contact_phone) && (
                <Section title="Emergency contact" icon={Phone}>
                  <Row label="Name" value={student.emergency_contact_name} />
                  <Row label="Phone" value={student.emergency_contact_phone} />
                </Section>
              )}

              {/* Authorized collectors */}
              {collectors.length > 0 && (
                <Section title="Authorized collectors" icon={Users}>
                  <div className="space-y-2">
                    {collectors.map((c, i) => (
                      <div key={i} className="rounded-2xl bg-secondary/50 p-3 text-sm">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.relationship} · {c.phone || c.email || ""}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Consent */}
              <Section title="Consent" icon={Camera}>
                <Row label="Photo consent" value={student.photo_consent ? "✓ Yes" : "✗ No"} />
                <Row label="Social media" value={student.social_media_consent ? "✓ Yes" : "✗ No"} />
              </Section>

              {/* Notes */}
              {student.notes && (
                <Section title="Notes" icon={Shield}>
                  <p className="text-sm rounded-2xl bg-secondary/60 p-3 whitespace-pre-wrap">{student.notes}</p>
                </Section>
              )}

              {/* Mark as — register status */}
              {booking && (onCheckIn || onCheckOut || onMarkAbsent || onClearAttendance) && (
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <h4 className="eyebrow">Mark as</h4>
                  <StatusMoment att={att} />
                  {markButtons}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default StudentProfileDrawer;
