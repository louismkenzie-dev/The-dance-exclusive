import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffMember } from "@/hooks/useStaffMember";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, ChevronLeft, ChevronRight, ScanLine, AlertTriangle, Check, XCircle, HelpCircle, LogOut, CalendarX } from "lucide-react";
import { addDays, differenceInYears, format, parseISO } from "date-fns";
import { FadeRise, Stagger, PressScale } from "@/components/motion";
import StudentProfileDrawer from "@/components/staff/StudentProfileDrawer";
import QrScannerDialog from "@/components/staff/QrScannerDialog";
import FamilyCheckInSheet from "@/components/staff/FamilyCheckInSheet";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const StaffRegisters = () => {
  const { staff } = useStaffMember();
  const { toast } = useToast();
  // Local date, not UTC — toISOString() opens yesterday's register after 11pm BST.
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessions, setSessions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [profileBooking, setProfileBooking] = useState<{ booking: any; sessionId: string; classId: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [collectorPrompt, setCollectorPrompt] = useState<{
    booking: any;
    sessionId: string;
    classId: string;
    method: "qr" | "manual";
  } | null>(null);
  const [collectorName, setCollectorName] = useState("");
  // A scanned family QR opens this sheet — one scan covers every attendee the
  // parent booked on the class; nothing is marked until staff tap the buttons.
  const [familySheet, setFamilySheet] = useState<{
    sessionId: string;
    classId: string;
    parentId: string;
    parentName: string | null;
  } | null>(null);

  useEffect(() => {
    if (!staff?.id) return;
    void load();
  }, [staff?.id, date]);

  const load = async () => {
    if (!staff) return;
    setLoading(true);

    const { data: explicit } = await supabase
      .from("session_instructors")
      .select(`class_sessions!inner ( id, session_date, start_time, end_time, class_id, classes:class_id ( name, class_type, venues:venue_id ( name ) ) )`)
      .eq("staff_id", staff.id);

    const { data: classAssignments } = await supabase
      .from("class_instructors")
      .select("class_id")
      .eq("staff_id", staff.id);

    let defaults: any[] = [];
    const classIds = (classAssignments ?? []).map((c) => c.class_id);
    if (classIds.length > 0) {
      const { data } = await supabase
        .from("class_sessions")
        .select(`id, session_date, start_time, end_time, class_id, classes:class_id ( name, class_type, venues:venue_id ( name ) )`)
        .in("class_id", classIds)
        .eq("session_date", date);
      const { data: overrides } = await supabase.from("session_instructors").select("session_id").in("session_id", (data ?? []).map((s) => s.id));
      const overrideIds = new Set((overrides ?? []).map((o: any) => o.session_id));
      defaults = (data ?? []).filter((s) => !overrideIds.has(s.id));
    }

    const all = [...((explicit ?? []).map((r: any) => r.class_sessions)), ...defaults]
      .filter((s) => s.session_date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    setSessions(all);

    // Fetch attendance + bookings per session
    const map: Record<string, any[]> = {};
    for (const s of all) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select(`id, student_id, parent_id, students:student_id ( first_name, last_name, preferred_name, profile_photo, avatar_url, date_of_birth, is_self, has_send, has_epipen, has_inhaler, allergies_list, medical_conditions_list, medical_info )`)
        .eq("class_id", s.class_id)
        .eq("status", "confirmed");
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("class_session_id", s.id);
      const attByBooking: Record<string, any> = {};
      att?.forEach((a: any) => (attByBooking[a.booking_id] = a));
      map[s.id] = (bookings ?? []).map((b: any) => ({ ...b, attendance: attByBooking[b.id] || null }));
    }
    setAttendance(map);
    setLoading(false);
  };

  const writeFailed = (error: { message: string } | null) => {
    if (!error) return false;
    toast({ title: "Couldn't update register", description: error.message, variant: "destructive" });
    return true;
  };

  // Attendance rows apply to adult self-bookings too — student_id may be null
  // on legacy adult bookings, which is valid (the column is nullable).
  const markAbsent = async (sessionId: string, classId: string, booking: any) => {
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id,
      class_id: classId,
      class_session_id: sessionId,
      student_id: booking.student_id ?? null,
      session_date: date,
      status: "absent",
      checked_in_at: null,
      checked_out_at: null,
    }, { onConflict: "booking_id,class_session_id" });
    if (writeFailed(error)) return;
    toast({ title: "Marked absent" });
    void load();
  };

  const clearAttendance = async (booking: any) => {
    if (!booking.attendance) return;
    // UPDATE, not DELETE — staff RLS has no delete policy, so a delete
    // silently matches nothing. Resetting to 'expected' renders as Unaccounted.
    const { error } = await supabase.from("attendance").update({
      status: "expected",
      checked_in_at: null,
      checked_out_at: null,
      check_in_method: null,
      check_out_method: null,
      collector_name: null,
    }).eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Status cleared" });
    void load();
  };

  const performCheckIn = async (booking: any, sessionId: string, classId: string, method: "qr" | "manual", collector: string | null) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id,
      class_id: classId,
      class_session_id: sessionId,
      student_id: booking.student_id ?? null,
      session_date: date,
      status: "present",
      checked_in_at: now,
      checked_out_at: null,
      check_in_method: method,
      collector_name: collector,
    }, { onConflict: "booking_id,class_session_id" });
    if (writeFailed(error)) return;
    toast({ title: "Checked in", description: collector ? `Dropped off by ${collector}` : undefined });
    void load();
  };

  const performCheckOut = async (booking: any, method: "qr" | "manual", collector: string | null) => {
    if (!booking.attendance) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("attendance").update({
      checked_out_at: now,
      check_out_method: method,
      collector_name: collector ?? booking.attendance.collector_name,
    }).eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Checked out", description: collector ? `Collected by ${collector}` : undefined });
    void load();
  };

  // Triggered by clicking "In" / "Out" buttons → asks for collector name
  const beginManualCheckIn = (sessionId: string, classId: string, booking: any) => {
    setCollectorName("");
    setCollectorPrompt({ booking, sessionId, classId, method: "manual" });
  };
  const beginManualCheckOut = (booking: any) => {
    setCollectorName("");
    setCollectorPrompt({ booking, sessionId: booking.attendance.class_session_id, classId: booking.attendance.class_id, method: "manual" });
  };

  const submitCollectorPrompt = async () => {
    if (!collectorPrompt) return;
    const { booking, sessionId, classId, method } = collectorPrompt;
    const isCheckOut = !!booking.attendance?.checked_in_at && !booking.attendance?.checked_out_at;
    const trimmed = collectorName.trim() || null;
    if (isCheckOut) await performCheckOut(booking, method, trimmed);
    else await performCheckIn(booking, sessionId, classId, method, trimmed);
    setCollectorPrompt(null);
  };

  // Scanner result → look up token and toggle in/out
  const handleScannedToken = async (token: string) => {
    setScannerOpen(false);
    const { data: t } = await supabase
      .from("booking_qr_tokens")
      .select("booking_id, valid_until")
      .eq("token", token)
      .maybeSingle();
    if (!t) {
      toast({ title: "Code not recognised", description: "Ask the parent to refresh their QR code.", variant: "destructive" });
      return;
    }
    if (new Date(t.valid_until) < new Date()) {
      toast({ title: "Code expired", description: "Ask the parent to open a fresh code.", variant: "destructive" });
      return;
    }
    // Find which of today's sessions this booking belongs to.
    let matchSessionId: string | null = null;
    let matchBooking: any = null;
    for (const [sessionId, rows] of Object.entries(attendance)) {
      const found = (rows as any[]).find((b) => b.id === t.booking_id);
      if (found) {
        matchSessionId = sessionId;
        matchBooking = found;
        break;
      }
    }
    if (!matchSessionId || !matchBooking) {
      toast({
        title: "Not on today's register",
        description: "This QR is valid, but the booking isn't scheduled in any of today's classes.",
        variant: "destructive",
      });
      return;
    }
    const session = sessions.find((s) => s.id === matchSessionId);
    const classId = session?.class_id ?? matchBooking.attendance?.class_id;

    // One family QR covers every attendee this parent booked on the class.
    // Never auto-mark — open the check-in sheet so staff choose per person.
    let parentName: string | null = null;
    if (matchBooking.parent_id) {
      const { data: parent } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", matchBooking.parent_id)
        .maybeSingle();
      parentName = parent?.full_name ?? null;
    }
    setFamilySheet({
      sessionId: matchSessionId,
      classId,
      parentId: matchBooking.parent_id,
      parentName,
    });
  };

  const shiftDate = (days: number) => {
    setDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));
  };

  const statusInfo = (att: any) => {
    if (att?.status === "absent")
      return { label: "Absent", variant: "destructive" as const, tint: "bg-destructive/10 text-destructive", Icon: XCircle };
    if (att?.checked_out_at)
      return { label: "Departed", variant: "default" as const, tint: "bg-primary/10 text-primary", Icon: LogOut };
    if (att?.checked_in_at)
      return { label: "Arrived", variant: "success" as const, tint: "bg-success/10 text-success", Icon: Check };
    return { label: "Unaccounted", variant: "secondary" as const, tint: "bg-secondary text-muted-foreground", Icon: HelpCircle };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Registers</h1>
            <p className="text-muted-foreground mt-1">Mark attendance for your classes</p>
          </div>
          <Button onClick={() => setScannerOpen(true)} size="lg" className="gap-2">
            <ScanLine className="w-4 h-4" /> Scan QR
          </Button>
        </div>
      </FadeRise>

      <FadeRise delay={60}>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center">
              <p className="font-display font-semibold">
                {new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs text-muted-foreground bg-transparent border-none text-center focus:outline-none"
              />
            </div>
            <Button variant="secondary" size="icon" aria-label="Next day" onClick={() => shiftDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </FadeRise>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : sessions.length === 0 ? (
        <FadeRise>
          <Card>
            <CardContent className="py-14 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <CalendarX className="h-6 w-6" />
              </div>
              <p className="text-muted-foreground">No classes scheduled for this day.</p>
            </CardContent>
          </Card>
        </FadeRise>
      ) : (
        <Stagger className="space-y-4">
          {sessions.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-bold text-lg truncate">{s.classes?.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · {s.classes?.venues?.name || "Venue TBC"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{(attendance[s.id] || []).length} students</Badge>
                </div>
                {(attendance[s.id] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center border-t border-border/50">
                    No bookings yet for this class.
                  </p>
                ) : (
                  <div className="divide-y divide-border/50 border-t border-border/50">
                    {attendance[s.id].map((b: any) => {
                      const att = b.attendance;
                      const student = b.students;
                      const age = student?.date_of_birth ? differenceInYears(new Date(), new Date(student.date_of_birth)) : null;
                      const hasMedical = !!(
                        student?.has_epipen || student?.has_inhaler ||
                        student?.allergies_list?.length || student?.medical_conditions_list?.length ||
                        student?.medical_info
                      );
                      const hasUrgent = student?.has_epipen || student?.has_inhaler;
                      const fmt = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                      const status = statusInfo(att);

                      return (
                        <PressScale key={b.id}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-secondary/40"
                            onClick={() => setProfileBooking({ booking: b, sessionId: s.id, classId: s.class_id })}
                          >
                            <PhotoAvatarDuo
                              photoUrl={student?.profile_photo}
                              avatarUrl={student?.avatar_url}
                              initials={student?.first_name?.[0] ?? "?"}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">
                                {student ? `${student.first_name} ${student.last_name}` : "Adult attendee"}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                                {age != null && <span>{age}y</span>}
                                {student?.is_self && <Badge variant="outline" className="text-[10px] px-2 py-0">Adult</Badge>}
                                {student?.has_send && <Badge variant="warning" className="text-[10px] px-2 py-0">SEND</Badge>}
                                {!student && <Badge variant="outline" className="text-[10px] px-2 py-0">No profile</Badge>}
                                {hasMedical && (
                                  hasUrgent ? (
                                    <span title="Urgent: EpiPen / Inhaler" className="inline-flex items-center gap-1 text-destructive">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Medical
                                    </span>
                                  ) : (
                                    <span title="Medical notes on file" className="inline-flex items-center gap-1 text-success">
                                      <Check className="w-3.5 h-3.5" /> Medical
                                    </span>
                                  )
                                )}
                                {(att?.checked_in_at || att?.checked_out_at) && (
                                  <span className="sm:hidden tabular-nums">
                                    {att?.checked_in_at && <>In {fmt(att.checked_in_at)}</>}
                                    {att?.checked_out_at && <> · Out {fmt(att.checked_out_at)}</>}
                                    {att?.collector_name && <> · {att.collector_name}</>}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="hidden sm:flex flex-col items-end text-xs tabular-nums shrink-0">
                              {att?.checked_in_at || att?.checked_out_at ? (
                                <>
                                  {att?.checked_in_at && <span className="text-foreground">In {fmt(att.checked_in_at)}</span>}
                                  {att?.checked_out_at && <span className="text-foreground">Out {fmt(att.checked_out_at)}</span>}
                                  {att?.collector_name && <span className="text-[11px] text-muted-foreground">{att.collector_name}</span>}
                                </>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <FadeRise key={status.label} className="flex">
                                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${status.tint}`}>
                                  <status.Icon className="w-4 h-4" />
                                </span>
                              </FadeRise>
                              <Badge variant={status.variant} className="hidden sm:inline-flex">{status.label}</Badge>
                            </div>
                          </div>
                        </PressScale>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </Stagger>
      )}

      <StudentProfileDrawer
        open={!!profileBooking}
        onOpenChange={(o) => !o && setProfileBooking(null)}
        studentId={profileBooking?.booking?.student_id ?? null}
        booking={profileBooking?.booking ?? null}
        sessionId={profileBooking?.sessionId ?? null}
        classId={profileBooking?.classId ?? null}
        onCheckIn={() => {
          if (!profileBooking) return;
          beginManualCheckIn(profileBooking.sessionId, profileBooking.classId, profileBooking.booking);
          setProfileBooking(null);
        }}
        onCheckOut={() => {
          if (!profileBooking) return;
          beginManualCheckOut(profileBooking.booking);
          setProfileBooking(null);
        }}
        onMarkAbsent={() => {
          if (!profileBooking) return;
          markAbsent(profileBooking.sessionId, profileBooking.classId, profileBooking.booking);
          setProfileBooking(null);
        }}
        onClearAttendance={() => {
          if (!profileBooking) return;
          clearAttendance(profileBooking.booking);
          setProfileBooking(null);
        }}
      />

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanned={handleScannedToken}
      />

      {(() => {
        if (!familySheet) return null;
        const session = sessions.find((s) => s.id === familySheet.sessionId);
        // Live rows from register state — statuses refresh as staff mark people.
        const rows = (attendance[familySheet.sessionId] || []).filter(
          (b: any) => b.parent_id === familySheet.parentId,
        );
        return (
          <FamilyCheckInSheet
            open={!!familySheet}
            onOpenChange={(o) => !o && setFamilySheet(null)}
            className={session?.classes?.name ?? "Class"}
            sessionTime={session ? `${session.start_time?.slice(0, 5)} – ${session.end_time?.slice(0, 5)}` : ""}
            parentName={familySheet.parentName}
            rows={rows}
            onMarkArrived={(b) => void performCheckIn(b, familySheet.sessionId, familySheet.classId, "qr", null)}
            onMarkDeparted={(b) => void performCheckOut(b, "qr", null)}
          />
        );
      })()}

      <Dialog open={!!collectorPrompt} onOpenChange={(o) => !o && setCollectorPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {collectorPrompt?.booking?.attendance?.checked_in_at && !collectorPrompt?.booking?.attendance?.checked_out_at
                ? "Who's collecting?"
                : "Who dropped off?"}
            </DialogTitle>
            <DialogDescription>
              Recording the collector's name keeps a safeguarding audit trail. Leave blank if a parent on file is doing it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="collector">Collector name (optional)</Label>
            <Input
              id="collector"
              value={collectorName}
              onChange={(e) => setCollectorName(e.target.value)}
              placeholder="e.g. Sarah Smith (Aunt)"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectorPrompt(null)}>Cancel</Button>
            <Button onClick={submitCollectorPrompt}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffRegisters;
