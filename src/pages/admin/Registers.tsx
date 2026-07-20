import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, LogIn, LogOut, AlertTriangle, Check, MapPin, Users, History, CalendarDays } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, differenceInYears, format, parseISO } from "date-fns";
import StudentProfileDrawer from "@/components/staff/StudentProfileDrawer";

const formatDay = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

const AdminRegisters = () => {
  const { toast } = useToast();
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayIso);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileBooking, setProfileBooking] = useState<{ booking: any; sessionId: string; classId: string } | null>(null);

  const isPast = date < todayIso;
  const isToday = date === todayIso;

  useEffect(() => {
    void loadSessions();
    setSelectedSessionId("");
    setBookings([]);
  }, [date]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void loadRegister();
  }, [selectedSessionId]);

  const loadSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("class_sessions")
      .select(`
        id, session_date, start_time, end_time, class_id,
        classes:class_id ( id, name, day_of_week, venues:venue_id ( name ) ),
        session_instructors ( staff:staff_id ( id, first_name, last_name, full_name ) )
      `)
      .eq("session_date", date)
      .order("start_time");

    const rows = data ?? [];

    // Default class instructors if no per-session override
    const classIds = Array.from(new Set(rows.map((r: any) => r.class_id)));
    let defaultByClass: Record<string, any[]> = {};
    if (classIds.length > 0) {
      const { data: ci } = await supabase
        .from("class_instructors")
        .select("class_id, staff:staff_id ( id, first_name, last_name, full_name )")
        .in("class_id", classIds);
      ci?.forEach((c: any) => {
        defaultByClass[c.class_id] = defaultByClass[c.class_id] || [];
        if (c.staff) defaultByClass[c.class_id].push(c.staff);
      });
    }

    const enriched = rows.map((s: any) => {
      const explicit = (s.session_instructors ?? []).map((si: any) => si.staff).filter(Boolean);
      const instructors = explicit.length > 0 ? explicit : (defaultByClass[s.class_id] ?? []);
      return { ...s, instructors };
    });

    setSessions(enriched);
    if (enriched.length > 0) setSelectedSessionId(enriched[0].id);
    setLoading(false);
  };

  const loadRegister = async () => {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    const [{ data: bks }, { data: att }] = await Promise.all([
      supabase
        .from("bookings")
        .select(`id, student_id, students:student_id ( id, first_name, last_name, preferred_name, profile_photo, date_of_birth, is_self, has_send, has_epipen, has_inhaler, allergies_list, medical_conditions_list, medical_info )`)
        .eq("class_id", session.class_id)
        .eq("status", "confirmed"),
      supabase
        .from("attendance")
        .select("*")
        .eq("class_session_id", session.id),
    ]);
    const attMap: Record<string, any> = {};
    (att ?? []).forEach((a: any) => (attMap[a.booking_id] = a));
    setBookings((bks ?? []).map((b: any) => ({ ...b, attendance: attMap[b.id] || null })));
  };

  const writeFailed = (error: { message: string } | null) => {
    if (!error) return false;
    toast({ title: "Couldn't update register", description: error.message, variant: "destructive" });
    return true;
  };

  // student_id may be null on legacy adult self-bookings — still markable.
  const checkIn = async (booking: any) => {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id, class_id: session.class_id, class_session_id: session.id,
      student_id: booking.student_id ?? null, session_date: session.session_date,
      status: "present", checked_in_at: now, checked_out_at: null, check_in_method: "manual",
    }, { onConflict: "booking_id,class_session_id" });
    if (writeFailed(error)) return;
    toast({ title: "Checked in" });
    void loadRegister();
  };

  const checkOut = async (booking: any) => {
    if (!booking.attendance) return;
    const { error } = await supabase.from("attendance").update({
      checked_out_at: new Date().toISOString(), check_out_method: "manual",
    }).eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Checked out" });
    void loadRegister();
  };

  const markAbsent = async (booking: any) => {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    const { error } = await supabase.from("attendance").upsert({
      booking_id: booking.id, class_id: session.class_id, class_session_id: session.id,
      student_id: booking.student_id ?? null, session_date: session.session_date, status: "absent",
      checked_in_at: null, checked_out_at: null,
    }, { onConflict: "booking_id,class_session_id" });
    if (writeFailed(error)) return;
    toast({ title: "Marked absent" });
    void loadRegister();
  };

  const clearAttendance = async (booking: any) => {
    if (!booking.attendance) return;
    const { error } = await supabase.from("attendance").delete().eq("id", booking.attendance.id);
    if (writeFailed(error)) return;
    toast({ title: "Status cleared" });
    void loadRegister();
  };

  const shiftDate = (days: number) => {
    setDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));
  };

  const presentCount = useMemo(() => bookings.filter((b) => b.attendance?.checked_in_at).length, [bookings]);
  const absentCount = useMemo(() => bookings.filter((b) => b.attendance?.status === "absent").length, [bookings]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const statusInfo = (att: any) => {
    if (att?.status === "absent") return { label: "Absent", badge: "bg-destructive text-destructive-foreground hover:bg-destructive", row: "border-l-2 border-l-destructive" };
    if (att?.checked_out_at) return { label: "Departed", badge: "bg-blue-500 text-white hover:bg-blue-500", row: "border-l-2 border-l-blue-500" };
    if (att?.checked_in_at) return { label: "Arrived", badge: "bg-success text-success-foreground hover:bg-success", row: "border-l-2 border-l-success" };
    return { label: "Unaccounted", badge: "bg-muted text-foreground hover:bg-muted", row: "border-l-2 border-l-border" };
  };

  const sessionLabel = (s: any) => {
    const cls = s.classes;
    const time = `${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)}`;
    const venue = cls?.venues?.name ?? "Venue TBC";
    const staff = (s.instructors ?? []).map((st: any) => st.first_name || st.full_name?.split(" ")[0] || "").filter(Boolean).join(", ");
    return `${cls?.name ?? "Class"} • ${time} • ${venue}${staff ? ` • ${staff}` : ""}`;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">{isPast ? "PAST REGISTERS" : "LIVE REGISTERS"}</h1>
          <p className="text-muted-foreground mt-1">Attendance for {format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isToday ? "default" : "outline"}
            onClick={() => setDate(todayIso)}
            className="gap-1.5"
          >
            <CalendarDays className="w-4 h-4" /> Today
          </Button>
          <Button
            variant={isPast ? "default" : "outline"}
            onClick={() => shiftDate(-1)}
            className="gap-1.5"
          >
            <History className="w-4 h-4" /> Past registers
          </Button>
        </div>
      </div>

      {/* Date navigator */}
      <Card className="mb-6">
        <CardContent className="p-3 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">{format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy")}</p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs text-muted-foreground bg-transparent border-none focus:outline-none mt-0.5"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No classes scheduled for this day.</CardContent></Card>
      ) : (
        <>
          {/* Session picker */}
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Pick a register</label>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-full md:w-[640px] h-auto py-3">
                <SelectValue>
                  {selectedSession && (
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedSession.classes?.name}</span>
                        <Badge variant="outline" className="text-[10px]">{format(new Date(selectedSession.session_date + "T00:00:00"), "EEE d MMM")}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedSession.start_time?.slice(0,5)}–{selectedSession.end_time?.slice(0,5)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedSession.classes?.venues?.name ?? "Venue TBC"}</span>
                        {selectedSession.instructors?.length > 0 && (
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedSession.instructors.map((s: any) => s.first_name || s.full_name).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-w-[90vw]">
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{s.classes?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(s.session_date + "T00:00:00"), "EEE d MMM")} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)} · {s.classes?.venues?.name ?? "Venue TBC"}
                        {s.instructors?.length > 0 && <> · {s.instructors.map((st: any) => st.first_name || st.full_name).join(", ")}</>}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSession && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border flex-wrap gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSession.classes?.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedSession.start_time?.slice(0,5)}–{selectedSession.end_time?.slice(0,5)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedSession.classes?.venues?.name ?? "Venue TBC"}</span>
                      {selectedSession.instructors?.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedSession.instructors.map((s: any) => s.full_name || `${s.first_name} ${s.last_name}`).join(", ")}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{bookings.length} booked</Badge>
                    <Badge className="bg-success text-success-foreground hover:bg-success">{presentCount} present</Badge>
                    {absentCount > 0 && <Badge variant="destructive">{absentCount} absent</Badge>}
                  </div>
                </div>

                {bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No confirmed bookings for this class.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="w-[80px]">Age</TableHead>
                        <TableHead className="w-[90px] text-center">Medical</TableHead>
                        <TableHead>Arrival / Departure</TableHead>
                        <TableHead className="text-right w-[140px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((b: any) => {
                        const att = b.attendance;
                        const isIn = att?.checked_in_at && !att?.checked_out_at;
                        const isOut = !!att?.checked_out_at;
                        const isAbsent = att?.status === "absent";
                        const student = b.students;
                        const age = student?.date_of_birth ? differenceInYears(new Date(), new Date(student.date_of_birth)) : null;
                        const hasMedical = !!(student?.has_epipen || student?.has_inhaler || student?.allergies_list?.length || student?.medical_conditions_list?.length || student?.medical_info);
                        const hasUrgent = student?.has_epipen || student?.has_inhaler;
                        const fmt = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                        const status = statusInfo(att);

                        return (
                          <TableRow key={b.id} className={`cursor-pointer ${status.row}`} onClick={() => setProfileBooking({ booking: b, sessionId: selectedSession.id, classId: selectedSession.class_id })}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {student?.profile_photo ? (
                                  <img src={student.profile_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {student?.first_name?.[0] ?? "?"}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm hover:underline">
                                    {student ? `${student.first_name} ${student.last_name}` : "Adult attendee"}
                                  </p>
                                  <div className="flex gap-1 mt-0.5">
                                    {student?.is_self && <Badge variant="outline" className="text-[10px]">Adult</Badge>}
                                    {student?.has_send && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">SEND</Badge>}
                                    {!student && <Badge variant="outline" className="text-[10px] text-muted-foreground">No profile</Badge>}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{age != null ? `${age}y` : "—"}</TableCell>
                            <TableCell className="text-center">
                              {hasMedical ? (
                                hasUrgent ? (
                                  <span title="Urgent: EpiPen / Inhaler" className="inline-flex items-center gap-1 text-destructive">
                                    <AlertTriangle className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <Check className="w-4 h-4 inline text-success" />
                                )
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {att?.checked_in_at || att?.checked_out_at ? (
                                <div className="flex flex-col gap-0.5">
                                  {att?.checked_in_at && <span className="text-foreground">In {fmt(att.checked_in_at)}</span>}
                                  {att?.checked_out_at && <span className="text-foreground">Out {fmt(att.checked_out_at)}</span>}
                                </div>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className={status.badge}>{status.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <StudentProfileDrawer
        open={!!profileBooking}
        onOpenChange={(o) => !o && setProfileBooking(null)}
        studentId={profileBooking?.booking?.student_id ?? null}
        booking={profileBooking?.booking ?? null}
        sessionId={profileBooking?.sessionId ?? null}
        classId={profileBooking?.classId ?? null}
        onCheckIn={profileBooking ? () => { checkIn(profileBooking.booking); setProfileBooking(null); } : undefined}
        onCheckOut={profileBooking ? () => { checkOut(profileBooking.booking); setProfileBooking(null); } : undefined}
        onMarkAbsent={profileBooking ? () => { markAbsent(profileBooking.booking); setProfileBooking(null); } : undefined}
        onClearAttendance={profileBooking ? () => { clearAttendance(profileBooking.booking); setProfileBooking(null); } : undefined}
      />
    </div>
  );
};

export default AdminRegisters;
