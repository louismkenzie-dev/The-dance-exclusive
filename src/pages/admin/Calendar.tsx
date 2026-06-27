import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, User,
  Plus, Pencil, Trash2, LayoutGrid, Columns, TableProperties,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isWeekend,
  isWithinInterval,
  parseISO,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from "date-fns";

interface SessionWithDetails {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  instructor_id: string | null;
  class_id: string;
  source: "class" | "camp";
  classes: {
    id: string;
    name: string;
    class_type: "children" | "adult";
    venue_id: string | null;
    instructor_id: string | null;
    venues: { name: string } | null;
    staff: { full_name: string } | null;
  } | null;
  staff: { full_name: string } | null;
}

interface CampSessionRaw {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  camp_id: string;
  camps: {
    id: string;
    name: string;
    class_type: "children" | "adult";
    venue_id: string | null;
    venues: { name: string } | null;
  } | null;
}

interface ClassOption {
  id: string;
  name: string;
  class_type: "children" | "adult";
  start_time: string;
  end_time: string;
  instructor_id: string | null;
}

interface StaffOption {
  id: string;
  full_name: string;
}

interface SessionFormData {
  class_id: string;
  start_time: string;
  end_time: string;
  instructor_id: string;
  status: string;
  notes: string;
}

const emptyForm: SessionFormData = {
  class_id: "",
  start_time: "",
  end_time: "",
  instructor_id: "__default",
  status: "scheduled",
  notes: "",
};

type ViewMode = "month" | "week";

const AdminCalendar = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionWithDetails | null>(null);
  const [formData, setFormData] = useState<SessionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Compute date ranges based on view mode
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthCalendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const queryStart = viewMode === "month" ? monthCalendarStart : weekStart;
  const queryEnd = viewMode === "month" ? monthCalendarEnd : weekEnd;

  const calendarDays = viewMode === "month"
    ? eachDayOfInterval({ start: monthCalendarStart, end: monthCalendarEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

      const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["calendar-sessions", viewMode, format(queryStart, "yyyy-MM-dd"), format(queryEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, status, notes, instructor_id, class_id,
          classes!inner(id, name, class_type, venue_id, instructor_id,
            venues(name),
            staff(full_name)
          ),
          staff(full_name)
        `)
        .gte("session_date", format(queryStart, "yyyy-MM-dd"))
        .lte("session_date", format(queryEnd, "yyyy-MM-dd"))
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({ ...s, source: "class" as const })) as SessionWithDetails[];
    },
  });

  // Fetch camp sessions
  const { data: campSessions = [] } = useQuery({
    queryKey: ["calendar-camp-sessions", viewMode, format(queryStart, "yyyy-MM-dd"), format(queryEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("camp_sessions")
        .select(`
          id, session_date, start_time, end_time, status, notes, camp_id,
          camps!inner(id, name, class_type, venue_id,
            venues(name)
          )
        `)
        .gte("session_date", format(queryStart, "yyyy-MM-dd"))
        .lte("session_date", format(queryEnd, "yyyy-MM-dd"))
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CampSessionRaw[];
    },
  });

  // Convert camp sessions to the unified format
  const campSessionsAsUnified: SessionWithDetails[] = campSessions.map(cs => ({
    id: cs.id,
    session_date: cs.session_date,
    start_time: cs.start_time,
    end_time: cs.end_time,
    status: cs.status,
    notes: cs.notes,
    instructor_id: null,
    class_id: cs.camp_id,
    source: "camp" as const,
    classes: cs.camps ? {
      id: cs.camps.id,
      name: cs.camps.name,
      class_type: cs.camps.class_type,
      venue_id: cs.camps.venue_id,
      instructor_id: null,
      venues: cs.camps.venues,
      staff: null,
    } : null,
    staff: null,
  }));

  const allSessions = [...sessions, ...campSessionsAsUnified].sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Fetch session_instructors and class_instructors for multi-instructor display
  const sessionIds = sessions.map(s => s.id);
  const classIds = [...new Set(sessions.map(s => s.class_id))];

  const { data: sessionInstructorMap = {} } = useQuery({
    queryKey: ["calendar-session-instructors", sessionIds.join(",")],
    queryFn: async () => {
      if (sessionIds.length === 0) return {};
      const { data } = await supabase
        .from("session_instructors")
        .select("session_id, staff_id")
        .in("session_id", sessionIds);
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.session_id]) map[r.session_id] = [];
        map[r.session_id].push(r.staff_id);
      });
      return map;
    },
    enabled: sessionIds.length > 0,
  });

  const { data: classInstructorMap = {} } = useQuery({
    queryKey: ["calendar-class-instructors", classIds.join(",")],
    queryFn: async () => {
      if (classIds.length === 0) return {};
      const { data } = await supabase
        .from("class_instructors")
        .select("class_id, staff_id")
        .in("class_id", classIds);
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.class_id]) map[r.class_id] = [];
        map[r.class_id].push(r.staff_id);
      });
      return map;
    },
    enabled: classIds.length > 0,
  });

  const { data: classList = [] } = useQuery({
    queryKey: ["calendar-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, class_type, start_time, end_time, instructor_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as ClassOption[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["calendar-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as StaffOption[];
    },
  });

  // Fetch school terms and holidays for calendar overlay
  const { data: schoolTerms = [] } = useQuery({
    queryKey: ["calendar-school-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_terms")
        .select("id, name, start_date, end_date, term_type")
        .order("start_date");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: schoolHolidays = [] } = useQuery({
    queryKey: ["calendar-school-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_holidays")
        .select("id, name, start_date, end_date, holiday_type")
        .order("start_date");
      if (error) throw error;
      return data || [];
    },
  });

  // Get thin bar overlays for a given day (weekdays only)
  const getDayBars = (day: Date) => {
    const dayOfWeek = day.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) return [];
    const bars: { name: string; type: "term" | "holiday" | "bank_holiday"; termType?: string }[] = [];
    for (const term of schoolTerms) {
      const start = parseISO(term.start_date);
      const end = parseISO(term.end_date);
      if (isWithinInterval(day, { start, end })) {
        bars.push({ name: term.name, type: "term", termType: term.term_type });
      }
    }
    for (const hol of schoolHolidays) {
      const start = parseISO(hol.start_date);
      const end = parseISO(hol.end_date);
      if (isWithinInterval(day, { start, end })) {
        bars.push({
          name: hol.name,
          type: hol.holiday_type === "bank_holiday" ? "bank_holiday" : "holiday",
        });
      }
    }
    return bars;
  };

  const getTermBarColor = (termType?: string) => {
    switch (termType) {
      case "autumn": return "bg-amber-400 dark:bg-amber-500";
      case "spring": return "bg-emerald-400 dark:bg-emerald-500";
      case "summer": return "bg-sky-400 dark:bg-sky-500";
      default: return "bg-emerald-400 dark:bg-emerald-500";
    }
  };

  const getInstructorNames = (session: SessionWithDetails): string => {
    // 1. Session-level overrides from join table
    const siIds = sessionInstructorMap[session.id];
    if (siIds && siIds.length > 0) {
      return siIds.map(id => staffList.find(s => s.id === id)?.full_name).filter(Boolean).join(", ") || "Unassigned";
    }
    // 2. Class-level instructors from join table
    const ciIds = classInstructorMap[session.class_id];
    if (ciIds && ciIds.length > 0) {
      return ciIds.map(id => staffList.find(s => s.id === id)?.full_name).filter(Boolean).join(", ") || "Unassigned";
    }
    // 3. Legacy single instructor fallback
    return session.staff?.full_name || session.classes?.staff?.full_name || "Unassigned";
  };

  const hasInstructorOverride = (session: SessionWithDetails): boolean => {
    return !!(sessionInstructorMap[session.id] && sessionInstructorMap[session.id].length > 0);
  };

  const getSessionsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return allSessions.filter((s) => s.session_date === dayStr);
  };

  const goBack = () => {
    if (viewMode === "month") setCurrentDate((p) => subMonths(p, 1));
    else setCurrentDate((p) => subWeeks(p, 1));
  };
  const goForward = () => {
    if (viewMode === "month") setCurrentDate((p) => addMonths(p, 1));
    else setCurrentDate((p) => addWeeks(p, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = viewMode === "month"
    ? format(currentDate, "MMMM yyyy")
    : `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    return `${h}:${m}`;
  };

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-camp-sessions"] });
  };

  const openCreateForm = () => {
    setEditingSession(null);
    setFormData(emptyForm);
    setSessionFormOpen(true);
  };

  const openCreateFormForDay = (day: Date) => {
    setSelectedDay(day);
    setEditingSession(null);
    setFormData(emptyForm);
    setSessionFormOpen(true);
  };

  const openEditForm = (session: SessionWithDetails) => {
    setEditingSession(session);
    setFormData({
      class_id: session.class_id,
      start_time: session.start_time?.slice(0, 5) || "",
      end_time: session.end_time?.slice(0, 5) || "",
      instructor_id: session.instructor_id || "__default",
      status: session.status,
      notes: session.notes || "",
    });
    setSessionFormOpen(true);
  };

  const openEditFormFromWeek = (session: SessionWithDetails) => {
    setSelectedDay(new Date(session.session_date));
    openEditForm(session);
  };

  const handleClassChange = (classId: string) => {
    const cls = classList.find((c) => c.id === classId);
    setFormData((prev) => ({
      ...prev,
      class_id: classId,
      start_time: prev.start_time || cls?.start_time?.slice(0, 5) || "",
      end_time: prev.end_time || cls?.end_time?.slice(0, 5) || "",
      instructor_id: prev.instructor_id !== "__default" ? prev.instructor_id : (cls?.instructor_id || "__default"),
    }));
  };

  const handleSave = async () => {
    if (!selectedDay || !formData.class_id) {
      toast({ title: "Please select a class", variant: "destructive" });
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      toast({ title: "Please set start and end times", variant: "destructive" });
      return;
    }

    setSaving(true);
    const sessionDate = format(selectedDay, "yyyy-MM-dd");
    const instructorId = formData.instructor_id === "__default" ? null : formData.instructor_id;

    if (editingSession) {
      const { error } = await supabase
        .from("class_sessions")
        .update({
          class_id: formData.class_id,
          start_time: formData.start_time,
          end_time: formData.end_time,
          instructor_id: instructorId,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq("id", editingSession.id);

      if (error) {
        toast({ title: "Error updating session", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Session updated" });
        setSessionFormOpen(false);
        invalidateCalendar();
      }
    } else {
      const { error } = await supabase
        .from("class_sessions")
        .insert({
          class_id: formData.class_id,
          session_date: sessionDate,
          start_time: formData.start_time,
          end_time: formData.end_time,
          instructor_id: instructorId,
          status: formData.status,
          notes: formData.notes || null,
        });

      if (error) {
        toast({ title: "Error creating session", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Session created" });
        setSessionFormOpen(false);
        invalidateCalendar();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingSession) return;
    setDeleting(true);
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", editingSession.id);

    if (error) {
      toast({ title: "Error deleting session", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Session deleted" });
      setSessionFormOpen(false);
      invalidateCalendar();
    }
    setDeleting(false);
  };

  const SessionDetail = ({ session }: { session: SessionWithDetails }) => {
    const cls = session.classes;
    const isAdult = cls?.class_type === "adult";
    const isCamp = session.source === "camp";
    const instructorName = getInstructorNames(session);
    const isOverride = hasInstructorOverride(session);

    return (
      <div className="space-y-2">
        <div>
          <p className="font-semibold text-sm">{cls?.name}</p>
          <div className="flex gap-1.5">
            {isCamp && <Badge className="bg-amber-500 text-white">Camp</Badge>}
            <Badge className={isAdult ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}>
              {isAdult ? "Adult" : "Children"}
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {instructorName}
              {isOverride && <span className="text-accent ml-1 text-xs">(override)</span>}
            </span>
          </div>
          {cls?.venues?.name && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{cls.venues.name}</span>
            </div>
          )}
          <div className="pt-1 border-t text-xs text-muted-foreground">
            {format(new Date(session.session_date), "EEEE d MMMM yyyy")}
          </div>
        </div>
      </div>
    );
  };

  // --- WEEK VIEW ---
  const WeekView = () => (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted">
        {calendarDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const isWeekendDay = isWeekend(day);
          const bars = getDayBars(day);
          return (
            <div
              key={idx}
              className={`p-2 text-center border-b border-r border-border last:border-r-0 ${
                isWeekendDay ? "text-muted-foreground" : ""
              }`}
            >
              <div className="text-xs font-medium">{format(day, "EEE")}</div>
              <div
                className={`text-lg font-semibold mt-0.5 ${
                  isToday
                    ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                    : ""
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="text-[10px] text-muted-foreground">{format(day, "MMM")}</div>
              {bars.map((bar, i) => (
                <div
                  key={i}
                  title={bar.name}
                  className={`h-1 rounded-full mt-1 ${
                    bar.type === "term"
                      ? getTermBarColor(bar.termType)
                      : bar.type === "bank_holiday"
                      ? "bg-red-400 dark:bg-red-500"
                      : "bg-red-300 dark:bg-red-400"
                  }`}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const daySessions = getSessionsForDay(day);
          const isWeekendDay = isWeekend(day);

          return (
            <div
              key={idx}
              className={`min-h-[300px] border-r border-border last:border-r-0 p-1.5 ${
                isWeekendDay ? "bg-muted/20" : ""
              }`}
            >
              <div className="space-y-1.5">
                {daySessions.map((session) => {
                  const cls = session.classes;
                  const isAdult = cls?.class_type === "adult";
                  const isCamp = session.source === "camp";
                  const instructorName = getInstructorNames(session);
                  const isOverride = hasInstructorOverride(session);

                  return (
                    <div
                      key={session.id}
                      onClick={() => !isCamp && openEditFormFromWeek(session)}
                      className={`rounded-md border p-2 transition-colors hover:shadow-sm ${
                        isCamp
                          ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 cursor-default"
                          : isAdult
                          ? "border-accent/40 bg-accent/10 hover:bg-accent/15 cursor-pointer"
                          : "border-primary/30 bg-primary/10 hover:bg-primary/15 cursor-pointer"
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{cls?.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {instructorName}
                          {isOverride && <span className="text-accent ml-0.5">(override)</span>}
                        </span>
                      </div>
                      {cls?.venues?.name && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{cls.venues.name}</span>
                        </div>
                      )}
                      {session.notes && (
                        <p className="text-[10px] italic text-muted-foreground mt-1 truncate">{session.notes}</p>
                      )}
                    </div>
                  );
                })}

                {/* Add session button for each day */}
                <button
                  onClick={() => openCreateFormForDay(day)}
                  className="w-full rounded-md border border-dashed border-border p-1.5 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- MONTH VIEW ---
  const MonthView = () => (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => (
          <div
            key={day}
            className={`p-2 text-center text-sm font-medium border-b border-border ${
              idx >= 5 ? "text-muted-foreground" : ""
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const daySessions = getSessionsForDay(day);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isWeekendDay = isWeekend(day);
          const bars = getDayBars(day);

          return (
            <div
              key={idx}
              onClick={() => setSelectedDay(day)}
              className={`min-h-[90px] sm:min-h-[110px] p-1 border-b border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/40 transition-colors ${
                !isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
              } ${isWeekendDay ? "bg-muted/20" : ""}`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <div
                  className={`text-sm ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                      : isWeekendDay
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </div>
              </div>

              {/* Thin colored bars for terms/holidays (not bank holidays) */}
              {bars.filter(b => b.type !== "bank_holiday").map((bar, i) => (
                <div
                  key={i}
                  title={bar.name}
                  className={`h-[3px] rounded-full mb-0.5 cursor-help ${
                    bar.type === "term"
                      ? getTermBarColor(bar.termType)
                      : "bg-red-300 dark:bg-red-400"
                  }`}
                />
              ))}

              {/* Bank holidays as proper calendar entries */}
              {bars.filter(b => b.type === "bank_holiday").map((bar, i) => (
                <div
                  key={`bh-${i}`}
                  className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                >
                  {bar.name}
                </div>
              ))}

              <div className="space-y-0.5 overflow-hidden">
                {daySessions.slice(0, 3).map((session) => {
                  const isAdult = session.classes?.class_type === "adult";
                  const isCamp = session.source === "camp";
                  const pill = (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer ${
                        isCamp
                          ? "bg-amber-500 text-white"
                          : isAdult
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {isCamp ? `🏕 ${session.classes?.name}` : session.classes?.name}
                    </div>
                  );

                  return isMobile ? (
                    <Popover key={session.id}>
                      <PopoverTrigger asChild>{pill}</PopoverTrigger>
                      <PopoverContent className="w-72 p-3">
                        <SessionDetail session={session} />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <HoverCard key={session.id} openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>{pill}</HoverCardTrigger>
                      <HoverCardContent className="w-72 p-3" side="right">
                        <SessionDetail session={session} />
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}

                {daySessions.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{daySessions.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-display">
                <CalendarDays className="h-6 w-6" />
                Class Calendar
              </CardTitle>
              <CardDescription>
                {viewMode === "month" ? "Monthly" : "Weekly"} overview of all scheduled class sessions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle */}
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none gap-1.5 h-8"
                  onClick={() => setViewMode("month")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none gap-1.5 h-8"
                  onClick={() => setViewMode("week")}
                >
                  <Columns className="h-3.5 w-3.5" />
                  Week
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[160px] text-center text-sm">
                  {headerLabel}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>Children</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-accent" />
              <span>Adult</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>Camp</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-[3px] rounded-full bg-amber-400" />
              <span>Autumn term</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-[3px] rounded-full bg-emerald-400" />
              <span>Spring term</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-[3px] rounded-full bg-sky-400" />
              <span>Summer term</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-[3px] rounded-full bg-red-300 dark:bg-red-400" />
              <span>School holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50" />
              <span>Bank holiday</span>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading calendar…</div>
          ) : viewMode === "month" ? (
            <MonthView />
          ) : (
            <WeekView />
          )}
        </CardContent>
      </Card>

      {/* Day detail dialog (month view only) */}
      <Dialog open={!!selectedDay && !sessionFormOpen && viewMode === "month"} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedDay && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-xl font-display">
                    {format(selectedDay, "EEEE d MMMM yyyy")}
                  </DialogTitle>
                  <Button size="sm" onClick={openCreateForm} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add Session
                  </Button>
                </div>
              </DialogHeader>
              {/* Term/holiday info for the selected day */}
              {(() => {
                const dayBars = getDayBars(selectedDay);
                if (dayBars.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {dayBars.map((bar, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className={`text-xs ${
                          bar.type === "term"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : bar.type === "bank_holiday"
                            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {bar.name}
                      </Badge>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const daySessions = getSessionsForDay(selectedDay);
                if (daySessions.length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm py-4">No sessions scheduled for this day.</p>
                  );
                }
                return (
                  <div className="space-y-3 mt-2">
                    {daySessions.map((session) => {
                      const cls = session.classes;
                      const isAdult = cls?.class_type === "adult";
                      const isCamp = session.source === "camp";
                      const instructorName = getInstructorNames(session);
                      const isOverride = hasInstructorOverride(session);

                      return (
                        <div
                          key={session.id}
                          className={`rounded-lg border p-4 space-y-2 ${
                            isCamp
                              ? "border-amber-500/40 bg-amber-500/5"
                              : isAdult
                              ? "border-accent/40 bg-accent/5"
                              : "border-primary/30 bg-primary/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{cls?.name}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              {isCamp && <Badge className="bg-amber-500 text-white">Camp</Badge>}
                              <Badge
                                className={
                                  isAdult
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-primary text-primary-foreground"
                                }
                              >
                                {isAdult ? "Adult" : "Children"}
                              </Badge>
                              {!isCamp && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditForm(session)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>
                                {instructorName}
                                {isOverride && <span className="text-accent ml-1 text-xs font-medium">(override)</span>}
                              </span>
                            </div>
                            {cls?.venues?.name && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{cls.venues.name}</span>
                              </div>
                            )}
                            {session.notes && (
                              <p className="text-xs italic pt-1">{session.notes}</p>
                            )}
                            {session.status !== "scheduled" && (
                              <Badge variant="outline" className="text-xs mt-1">{session.status}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Session create/edit form dialog */}
      <Dialog open={sessionFormOpen} onOpenChange={(open) => {
        if (!open) setSessionFormOpen(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingSession ? "Edit Session" : "New Session"}
              {selectedDay && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  — {format(selectedDay, "d MMMM yyyy")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={formData.class_id} onValueChange={handleClassChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class…" />
                </SelectTrigger>
                <SelectContent>
                  {classList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.name}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {c.class_type}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Instructor</Label>
              <Select
                value={formData.instructor_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, instructor_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">Class default</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes…"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                {editingSession && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSessionFormOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : editingSession ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Weekly Timetable */}
      <TimetableSection />
    </div>
  );
};

/* ─── Inline Timetable ─── */

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface TimetableClass {
  id: string;
  name: string;
  class_type: string;
  dance_style: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  venues: { name: string } | null;
  staff: { full_name: string } | null;
}

const TimetableSection = () => {
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["timetable-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, class_type, dance_style, day_of_week, start_time, end_time, capacity, venues(name), staff(full_name)")
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as TimetableClass[];
    },
  });

  const classesByDay = DAYS.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day),
  }));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-2xl font-display">
          <TableProperties className="h-6 w-6" />
          Weekly Timetable
        </CardTitle>
        <CardDescription>Recurring class schedule by day of week</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Loading timetable...</div>
        ) : (
          <div className="grid gap-4">
            {classesByDay.map(({ day, classes: dayClasses }) => (
              <div key={day} className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted px-4 py-2">
                  <h3 className="text-sm font-semibold capitalize">{day}</h3>
                </div>
                <div className="p-3">
                  {dayClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No classes scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {dayClasses.map((c) => (
                        <div key={c.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg bg-muted/50">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                            <div className="text-xs md:text-sm font-mono font-medium text-primary whitespace-nowrap">
                              {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium break-words">{c.name}</span>
                              {c.dance_style && <span className="text-muted-foreground ml-2 text-sm">({c.dance_style})</span>}
                            </div>
                            <Badge variant={c.class_type === "children" ? "default" : "secondary"}>
                              {c.class_type === "children" ? "Children" : "Adult"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground min-w-0">
                            {c.venues && <span className="truncate">{(c.venues as any).name}</span>}
                            {c.staff && <span className="truncate">{(c.staff as any).full_name}</span>}
                            <span className="whitespace-nowrap">Cap: {c.capacity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminCalendar;
