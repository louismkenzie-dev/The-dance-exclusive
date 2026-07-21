import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isPast, isToday } from "date-fns";
import { UserCheck, UserX, Clock, User, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface SessionData {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  instructor_id: string | null;
  price_override: number | null;
  staff?: { full_name: string } | null;
}

interface AttendanceRecord {
  id: string;
  student_id: string | null;
  booking_id: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  notes: string | null;
  students?: { first_name: string; last_name: string } | null;
}

interface StaffOption {
  id: string;
  full_name: string;
}

interface Props {
  classId: string;
  className: string;
  defaultInstructorIds: string[];
  staffList: StaffOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const ATTENDANCE_STATUS: Record<string, { label: string; color: string; icon: typeof UserCheck }> = {
  expected: { label: "Expected", color: "text-muted-foreground", icon: Clock },
  present: { label: "Present", color: "text-success", icon: UserCheck },
  absent: { label: "Absent", color: "text-destructive", icon: UserX },
};

export default function SessionManager({ classId, className, defaultInstructorIds, staffList, open, onOpenChange }: Props) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const [sessionInstructors, setSessionInstructors] = useState<Record<string, string[]>>({});
  const [savingSession, setSavingSession] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("class_sessions")
      .select("*, staff(full_name)")
      .eq("class_id", classId)
      .order("session_date", { ascending: true });

    if (data) {
      setSessions(data as any);
      // Fetch session instructors for all sessions
      const ids = data.map((s: any) => s.id);
      if (ids.length > 0) {
        const { data: siData } = await supabase
          .from("session_instructors")
          .select("session_id, staff_id")
          .in("session_id", ids);
        if (siData) {
          const map: Record<string, string[]> = {};
          siData.forEach((r: any) => {
            if (!map[r.session_id]) map[r.session_id] = [];
            map[r.session_id].push(r.staff_id);
          });
          setSessionInstructors(map);
        }
      }
    }
    if (error) toast({ title: "Error loading sessions", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const fetchAttendance = async (sessionId: string, sessionDate: string) => {
    const { data } = await supabase
      .from("attendance")
      .select("*, students(first_name, last_name)")
      .eq("class_id", classId)
      .eq("session_date", sessionDate);

    if (data) {
      setAttendance(prev => ({ ...prev, [sessionId]: data as any }));
    }
  };

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, classId]);

  const toggleExpand = async (session: SessionData) => {
    if (expandedSession === session.id) {
      setExpandedSession(null);
    } else {
      setExpandedSession(session.id);
      if (!attendance[session.id]) {
        await fetchAttendance(session.id, session.session_date);
      }
    }
  };

  const getSessionInstructorIds = (sessionId: string): string[] => {
    // If session has its own instructors, use those; otherwise fall back to class defaults
    return sessionInstructors[sessionId] ?? defaultInstructorIds;
  };

  const addSessionInstructor = async (sessionId: string, staffId: string) => {
    setSavingSession(sessionId);
    const current = sessionInstructors[sessionId] ?? [...defaultInstructorIds];
    // If this is the first override, save all current defaults + new one
    const newIds = [...current, staffId];

    // Delete existing and re-insert
    await supabase.from("session_instructors").delete().eq("session_id", sessionId);
    const { error } = await supabase.from("session_instructors").insert(
      newIds.map(sid => ({ session_id: sessionId, staff_id: sid }))
    );
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSessionInstructors(prev => ({ ...prev, [sessionId]: newIds }));
    }
    setSavingSession(null);
  };

  const removeSessionInstructor = async (sessionId: string, staffId: string) => {
    setSavingSession(sessionId);
    const current = sessionInstructors[sessionId] ?? [...defaultInstructorIds];
    const newIds = current.filter(id => id !== staffId);

    await supabase.from("session_instructors").delete().eq("session_id", sessionId);
    if (newIds.length > 0) {
      await supabase.from("session_instructors").insert(
        newIds.map(sid => ({ session_id: sessionId, staff_id: sid }))
      );
    }
    setSessionInstructors(prev => ({ ...prev, [sessionId]: newIds }));
    setSavingSession(null);
  };

  const resetSessionInstructors = async (sessionId: string) => {
    setSavingSession(sessionId);
    await supabase.from("session_instructors").delete().eq("session_id", sessionId);
    setSessionInstructors(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setSavingSession(null);
  };

  const updateSessionStatus = async (sessionId: string, status: string) => {
    const { error } = await supabase.from("class_sessions").update({ status }).eq("id", sessionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status } : s));
    }
  };

  const updateSessionTime = async (sessionId: string, field: "start_time" | "end_time", value: string) => {
    const { error } = await supabase.from("class_sessions").update({ [field]: value }).eq("id", sessionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, [field]: value } : s));
    }
  };

  const updateSessionPrice = async (sessionId: string, value: string) => {
    const price = value === "" ? null : parseFloat(value);
    const { error } = await supabase.from("class_sessions").update({ price_override: price }).eq("id", sessionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, price_override: price } : s));
    }
  };

  const updateAttendanceStatus = async (attendanceId: string, sessionId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "present" && !attendance[sessionId]?.find(a => a.id === attendanceId)?.checked_in_at) {
      updates.checked_in_at = new Date().toISOString();
    }
    const { error } = await supabase.from("attendance").update(updates).eq("id", attendanceId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAttendance(prev => ({
        ...prev,
        [sessionId]: prev[sessionId]?.map(a => a.id === attendanceId ? { ...a, ...updates } : a) || [],
      }));
    }
  };

  const getInstructorDisplay = (sessionId: string) => {
    const ids = getSessionInstructorIds(sessionId);
    if (ids.length === 0) return "Unassigned";
    const names = ids.map(id => staffList.find(s => s.id === id)?.full_name).filter(Boolean);
    const isOverride = sessionInstructors[sessionId] !== undefined;
    return names.join(", ") + (isOverride ? "" : " (default)");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Sessions — {className}
            <Badge variant="secondary">{sessions.length} sessions</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground text-center py-8">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">No sessions found for this class.</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const dateObj = parseISO(session.session_date);
              const past = isPast(dateObj) && !isToday(dateObj);
              const today = isToday(dateObj);
              const expanded = expandedSession === session.id;
              const sessionAttendance = attendance[session.id] || [];
              const currentIds = getSessionInstructorIds(session.id);
              const isOverridden = sessionInstructors[session.id] !== undefined;

              return (
                <div key={session.id} className={`rounded-2xl transition-colors ${today ? 'bg-primary/5 ring-1 ring-primary/30' : 'bg-secondary/40'} ${past ? 'opacity-70' : ''}`}>
                  {/* Session header row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => toggleExpand(session)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {format(dateObj, "EEEE, d MMM yyyy")}
                        </span>
                        {today && <Badge className="text-xs">Today</Badge>}
                        <Badge className={`text-xs capitalize ${STATUS_COLORS[session.status] || 'bg-secondary text-secondary-foreground'}`}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getInstructorDisplay(session.id)}
                        </span>
                        {session.price_override != null && (
                          <span className="font-medium text-foreground">£{session.price_override}</span>
                        )}
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="border-t border-border/50 px-3 pb-3 pt-3 space-y-4">
                      {/* Session controls */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Start time</label>
                          <Input
                            type="time"
                            value={session.start_time?.slice(0, 5)}
                            onChange={e => updateSessionTime(session.id, "start_time", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">End time</label>
                          <Input
                            type="time"
                            value={session.end_time?.slice(0, 5)}
                            onChange={e => updateSessionTime(session.id, "end_time", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Price (£)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Class default"
                            value={session.price_override ?? ""}
                            onChange={e => updateSessionPrice(session.id, e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Status</label>
                          <Select value={session.status} onValueChange={v => updateSessionStatus(session.id, v)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Instructors */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="eyebrow">
                            Instructors ({currentIds.length})
                            {!isOverridden && <span className="normal-case tracking-normal ml-1">(using class defaults)</span>}
                          </h4>
                          {isOverridden && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => resetSessionInstructors(session.id)}>
                              Reset to defaults
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {currentIds.map(id => {
                            const s = staffList.find(st => st.id === id);
                            return s ? (
                              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                                {s.full_name}
                                <button
                                  type="button"
                                  onClick={() => removeSessionInstructor(session.id, id)}
                                  className="ml-1 hover:text-destructive"
                                  disabled={savingSession === session.id}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                        <Select
                          value=""
                          onValueChange={(v) => { if (v) addSessionInstructor(session.id, v); }}
                          disabled={savingSession === session.id}
                        >
                          <SelectTrigger className="h-8 text-sm w-56">
                            <SelectValue placeholder="Add instructor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {staffList.filter(s => !currentIds.includes(s.id)).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Attendance */}
                      <div>
                        <h4 className="eyebrow mb-2">
                          Attendance ({sessionAttendance.length} student{sessionAttendance.length !== 1 ? 's' : ''})
                        </h4>
                        {sessionAttendance.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No bookings / attendance records for this session yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {sessionAttendance.map(record => {
                              const statusInfo = ATTENDANCE_STATUS[record.status] || ATTENDANCE_STATUS.expected;
                              const Icon = statusInfo.icon;
                              return (
                                <div key={record.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-xl hover:bg-secondary/60 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${statusInfo.color}`} />
                                    <span className="text-sm text-foreground">
                                      {record.students ? `${record.students.first_name} ${record.students.last_name}` : "Unknown"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant={record.status === "present" ? "default" : "ghost"}
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => updateAttendanceStatus(record.id, session.id, "present")}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Present
                                    </Button>
                                    <Button
                                      variant={record.status === "absent" ? "destructive" : "ghost"}
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => updateAttendanceStatus(record.id, session.id, "absent")}
                                    >
                                      <X className="w-3 h-3 mr-1" /> Absent
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
