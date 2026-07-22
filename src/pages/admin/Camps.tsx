import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, X, Copy, MapPin, Calendar, Users, Clock } from "lucide-react";
import { format, parseISO, eachDayOfInterval, isBefore, isWeekend, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, getDay } from "date-fns";

interface WorkshopOption {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  dance_style: string | null;
  class_type: string;
  age_min: number | null;
  age_max: number | null;
  cover_image: string | null;
  capacity: number | null;
}

interface CampData {
  id: string;
  name: string;
  description: string | null;
  class_type: string;
  dance_style: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number;
  price_per_day: number | null;
  price_total: number | null;
  sibling_discount_enabled: boolean;
  venue_id: string | null;
  workshop_id: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  venues?: { name: string } | null;
  workshops?: { name: string; cover_image: string | null } | null;
}

interface SessionRow {
  date: string;
  dayLabel: string;
  start_time: string;
  end_time: string;
}

const AdminCamps = () => {
  const [camps, setCamps] = useState<CampData[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; capacity: number | null }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; pay_per_hour: number | null }[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [expandedCampId, setExpandedCampId] = useState<string | null>(null);
  const [campSessionCounts, setCampSessionCounts] = useState<Record<string, number>>({});
  const [showPast, setShowPast] = useState(false);
  const [schoolHolidays, setSchoolHolidays] = useState<{ id: string; name: string; start_date: string; end_date: string; academic_year: string; holiday_type: string }[]>([]);
  const { toast } = useToast();

  // Form state
  const [classType, setClassType] = useState<"children" | "adult">("children");
  const [workshopId, setWorkshopId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [mainInstructorId, setMainInstructorId] = useState<string>("");
  const [instructorPayOverrides, setInstructorPayOverrides] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [defaultEndTime, setDefaultEndTime] = useState("16:00");
  const [capacity, setCapacity] = useState("20");
  const [pricePerDay, setPricePerDay] = useState("");
  const [priceTotal, setPriceTotal] = useState("");
  const [siblingDiscountEnabled, setSiblingDiscountEnabled] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionStaffing, setSessionStaffing] = useState<Record<number, string[]>>({});
  const [campInstructors, setCampInstructors] = useState<Record<string, string[]>>({});
  const [campInstructorDetails, setCampInstructorDetails] = useState<Record<string, { staff_id: string; instructor_role: string; pay_per_hour_override: number | null }[]>>({});
  const [selectedHolidayId, setSelectedHolidayId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const filteredWorkshops = useMemo(() =>
    workshops.filter(w => w.class_type === classType).sort((a, b) => a.name.localeCompare(b.name)),
    [workshops, classType]
  );
  const selectedWorkshop = useMemo(() => workshops.find(w => w.id === workshopId), [workshops, workshopId]);
  const today = new Date();

  const filteredCamps = useMemo(() => {
    return camps.filter(c => {
      const isPast = c.end_date ? isBefore(parseISO(c.end_date), today) : !c.is_active;
      if (showPast) return isPast;
      return !isPast;
    });
  }, [camps, showPast]);

  const fetchData = async () => {
    const [campsRes, venuesRes, staffRes, workshopsRes, holidaysRes] = await Promise.all([
      supabase.from("camps").select("*, venues(name), workshops(name, cover_image)").order("created_at", { ascending: false }),
      supabase.from("venues").select("id, name, capacity").eq("is_active", true),
      supabase.from("staff").select("id, full_name, pay_per_hour").eq("is_active", true),
      supabase.from("workshops").select("id, name, description, theme, dance_style, class_type, age_min, age_max, cover_image, capacity").eq("is_active", true),
      supabase.from("school_holidays").select("*").neq("holiday_type", "bank_holiday").order("start_date"),
    ]);

    if (campsRes.data) setCamps(campsRes.data as any);
    if (venuesRes.data) setVenues(venuesRes.data);
    if (staffRes.data) setStaffList(staffRes.data);
    if (workshopsRes.data) setWorkshops(workshopsRes.data as any);
    if (holidaysRes.data) setSchoolHolidays(holidaysRes.data);

    // Fetch session counts
    if (campsRes.data) {
      const ids = campsRes.data.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: sessionData } = await supabase.from("camp_sessions").select("camp_id").in("camp_id", ids);
        if (sessionData) {
          const counts: Record<string, number> = {};
          sessionData.forEach((s: any) => { counts[s.camp_id] = (counts[s.camp_id] || 0) + 1; });
          setCampSessionCounts(counts);
        }
      }

      // Fetch camp instructors (with role + pay override)
      if (ids.length > 0) {
        const { data: instrData } = await supabase.from("camp_instructors").select("camp_id, staff_id, instructor_role, pay_per_hour_override").in("camp_id", ids);
        if (instrData) {
          const map: Record<string, string[]> = {};
          const details: Record<string, { staff_id: string; instructor_role: string; pay_per_hour_override: number | null }[]> = {};
          instrData.forEach((r: any) => {
            if (!map[r.camp_id]) map[r.camp_id] = [];
            map[r.camp_id].push(r.staff_id);
            if (!details[r.camp_id]) details[r.camp_id] = [];
            details[r.camp_id].push({
              staff_id: r.staff_id,
              instructor_role: r.instructor_role || "assistant",
              pay_per_hour_override: r.pay_per_hour_override,
            });
          });
          setCampInstructors(map);
          setCampInstructorDetails(details);
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setClassType("children");
    setWorkshopId("");
    setVenueId("");
    setInstructorIds([]);
    setMainInstructorId("");
    setInstructorPayOverrides({});
    setStartDate("");
    setEndDate("");
    setDefaultStartTime("09:00");
    setDefaultEndTime("16:00");
    setCapacity("20");
    setPricePerDay("");
    setPriceTotal("");
    setSiblingDiscountEnabled(true);
    setSessions([]);
    setSessionStaffing({});
    setEditing(null);
    setStep(1);
    setSelectedHolidayId(null);
    setSelectedDates(new Set());
  };

  // Generate sessions from selected dates or date range
  const generateSessions = () => {
    let dates: string[];
    if (selectedDates.size > 0) {
      dates = Array.from(selectedDates).sort();
    } else if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (isBefore(end, start)) return;
      dates = eachDayOfInterval({ start, end }).map(d => format(d, "yyyy-MM-dd"));
    } else {
      return;
    }

    const newSessions: SessionRow[] = dates.map(d => ({
      date: d,
      dayLabel: format(parseISO(d), "EEEE, d MMM yyyy"),
      start_time: defaultStartTime,
      end_time: defaultEndTime,
    }));
    setSessions(newSessions);
    // Set start/end date from selected dates for the camp record
    if (dates.length > 0) {
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
    }
  };

  useEffect(() => {
    if (step === 2 && selectedDates.size > 0) {
      generateSessions();
    } else if (step === 2 && startDate && endDate && selectedDates.size === 0 && !selectedHolidayId) {
      generateSessions();
    }
  }, [startDate, endDate, step, selectedDates]);

  // When a holiday is selected, pre-select all weekdays
  const selectHoliday = (holiday: typeof schoolHolidays[0]) => {
    if (selectedHolidayId === holiday.id) {
      // Deselect
      setSelectedHolidayId(null);
      setSelectedDates(new Set());
      setStartDate("");
      setEndDate("");
      setSessions([]);
      return;
    }
    setSelectedHolidayId(holiday.id);
    const days = eachDayOfInterval({ start: parseISO(holiday.start_date), end: parseISO(holiday.end_date) });
    const weekdays = days.filter(d => !isWeekend(d)).map(d => format(d, "yyyy-MM-dd"));
    setSelectedDates(new Set(weekdays));
    setStartDate(holiday.start_date);
    setEndDate(holiday.end_date);
  };

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const updateSessionTime = (idx: number, field: "start_time" | "end_time", val: string) => {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const populateForm = (c: CampData, isEdit: boolean) => {
    setClassType((c.class_type as "children" | "adult") || "children");
    setWorkshopId(c.workshop_id || "");
    setVenueId(c.venue_id || "");
    // Instructors + roles + pay overrides
    const details = campInstructorDetails[c.id] || [];
    const ids = details.length > 0 ? details.map(d => d.staff_id) : (campInstructors[c.id] || []);
    setInstructorIds(ids);
    const main = details.find(d => d.instructor_role === "main");
    setMainInstructorId(main?.staff_id || ids[0] || "");
    const payMap: Record<string, string> = {};
    details.forEach(d => {
      if (d.pay_per_hour_override != null) payMap[d.staff_id] = d.pay_per_hour_override.toString();
    });
    setInstructorPayOverrides(payMap);
    setStartDate(c.start_date || "");
    setEndDate(c.end_date || "");
    setDefaultStartTime(c.start_time?.slice(0, 5) || "09:00");
    setDefaultEndTime(c.end_time?.slice(0, 5) || "16:00");
    setCapacity(c.capacity.toString());
    setPricePerDay(c.price_per_day?.toString() || "");
    setPriceTotal(c.price_total?.toString() || "");
    setSiblingDiscountEnabled(c.sibling_discount_enabled ?? true);
    setEditing(isEdit ? c : null);
    setStep(1);
    setOpen(true);
  };

  const openEdit = (c: CampData) => populateForm(c, true);
  const openClone = (c: CampData) => populateForm(c, false);

  const handleSubmit = async () => {
    if (!selectedWorkshop) return;
    setSaving(true);

    const payload: any = {
      name: selectedWorkshop.name,
      description: selectedWorkshop.description,
      class_type: classType as any,
      dance_style: selectedWorkshop.dance_style,
      age_min: selectedWorkshop.age_min,
      age_max: selectedWorkshop.age_max,
      workshop_id: workshopId || null,
      venue_id: venueId || null,
      start_date: startDate || null,
      end_date: endDate || null,
      start_time: defaultStartTime,
      end_time: defaultEndTime,
      capacity: parseInt(capacity) || 20,
      price_per_day: pricePerDay ? parseFloat(pricePerDay) : null,
      price_total: priceTotal ? parseFloat(priceTotal) : null,
      sibling_discount_enabled: siblingDiscountEnabled,
    };

    let campId: string;

    if (editing) {
      const { error } = await supabase.from("camps").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      campId = editing.id;
      await supabase.from("camp_sessions").delete().eq("camp_id", campId);
    } else {
      const { data, error } = await supabase.from("camps").insert(payload).select("id").single();
      if (error || !data) {
        toast({ title: "Error", description: error?.message || "Failed to create camp", variant: "destructive" });
        setSaving(false);
        return;
      }
      campId = data.id;
    }

    // Insert sessions
    if (sessions.length > 0) {
      const sessionRows = sessions.map((s, i) => ({
        camp_id: campId,
        session_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
      }));
      const { data: insertedSessions, error: sessError } = await supabase.from("camp_sessions").insert(sessionRows).select("id");
      if (sessError) {
        toast({ title: "Warning", description: `Camp saved but sessions failed: ${sessError.message}`, variant: "destructive" });
      }

      // Save session-level instructor assignments
      if (insertedSessions) {
        // Clear any stale instructor rows for THIS camp's sessions only.
        // (Old sessions for the camp were deleted above, so the freshly inserted
        // sessions are the camp's full current session set.)
        const currentSessionIds = insertedSessions.map(s => s.id);
        if (currentSessionIds.length > 0) {
          await supabase.from("camp_session_instructors").delete().in("session_id", currentSessionIds);
        }
        const sessionInstructorRows: { session_id: string; staff_id: string }[] = [];
        insertedSessions.forEach((sess, i) => {
          const staffIds = sessionStaffing[i] && sessionStaffing[i].length > 0 ? sessionStaffing[i] : instructorIds;
          staffIds.forEach(sid => {
            sessionInstructorRows.push({ session_id: sess.id, staff_id: sid });
          });
        });
        if (sessionInstructorRows.length > 0) {
          await supabase.from("camp_session_instructors").insert(sessionInstructorRows);
        }
      }
    }

    // Save camp instructors with role (exactly one main) + optional pay override
    await supabase.from("camp_instructors").delete().eq("camp_id", campId);
    if (instructorIds.length > 0) {
      // Ensure exactly one main: fall back to the first instructor if the marked main isn't in the list
      const resolvedMain = instructorIds.includes(mainInstructorId) ? mainInstructorId : instructorIds[0];
      await supabase.from("camp_instructors").insert(
        instructorIds.map(sid => {
          const override = instructorPayOverrides[sid];
          return {
            camp_id: campId,
            staff_id: sid,
            instructor_role: sid === resolvedMain ? "main" : "assistant",
            pay_per_hour_override: override !== undefined && override !== "" ? parseFloat(override) : null,
          };
        })
      );
    }

    toast({ title: editing ? "Camp updated" : "Camp created" });
    setOpen(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("camps").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Camp deleted" }); fetchData(); }
    setDeleteId(null);
  };

  const canProceedStep1 = !!workshopId;
  const canProceedStep2 = (!!startDate && !!endDate && sessions.length > 0) || selectedDates.size > 0;

  if (loading) return <div className="p-4 md:p-8 text-muted-foreground">Loading camps…</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Camps</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Manage holiday camps & one-off events</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="self-start md:self-auto"><Plus className="w-4 h-4 mr-2" /> Add Camp</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Camp" : "New Camp"}</DialogTitle>
            </DialogHeader>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4].map(s => {
                const canNavigate = s === 1 || (s === 2 && canProceedStep1) || (s === 3 && canProceedStep1 && canProceedStep2) || (s === 4 && canProceedStep1 && canProceedStep2 && sessions.length > 0);
                const labels: Record<number, string> = { 1: "Details", 2: "Dates & Sessions", 3: "Review Sessions", 4: "Staffing" };
                return (
                  <div key={s} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => canNavigate && setStep(s)}
                      disabled={!canNavigate}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        step === s
                          ? 'bg-primary text-primary-foreground'
                          : step > s
                            ? 'bg-primary/30 text-primary-foreground cursor-pointer hover:bg-primary/50'
                            : canNavigate
                              ? 'bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80'
                              : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {s}
                    </button>
                    <span
                      className={`text-xs hidden sm:inline cursor-pointer ${step === s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                      onClick={() => canNavigate && setStep(s)}
                    >
                      {labels[s]}
                    </span>
                    {s < 4 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Workshop, Venue, Pricing */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Camp Type *</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={classType === "children" ? "default" : "outline"} onClick={() => { setClassType("children"); setWorkshopId(""); }}>Children</Button>
                    <Button type="button" variant={classType === "adult" ? "default" : "outline"} onClick={() => { setClassType("adult"); setWorkshopId(""); }}>Adult</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Workshop Theme *</Label>
                  <Select value={workshopId} onValueChange={setWorkshopId}>
                    <SelectTrigger><SelectValue placeholder="Choose a workshop..." /></SelectTrigger>
                    <SelectContent>
                      {filteredWorkshops.map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} {w.dance_style ? `(${w.dance_style})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWorkshop && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start gap-4">
                        {selectedWorkshop.cover_image && (
                          <img
                            src={selectedWorkshop.cover_image}
                            alt={selectedWorkshop.name}
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground">{selectedWorkshop.name}</h4>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {selectedWorkshop.dance_style && <Badge variant="outline">{selectedWorkshop.dance_style}</Badge>}
                            <Badge variant="secondary">{selectedWorkshop.class_type === "children" ? "Children" : "Adult"}</Badge>
                            {selectedWorkshop.theme && <Badge variant="outline">{selectedWorkshop.theme}</Badge>}
                            {(selectedWorkshop.age_min || selectedWorkshop.age_max) && (
                              <Badge variant="outline">Ages {selectedWorkshop.age_min || '?'}–{selectedWorkshop.age_max || '?'}</Badge>
                            )}
                          </div>
                          {selectedWorkshop.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{selectedWorkshop.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={venueId} onValueChange={(v) => {
                    setVenueId(v);
                    const venue = venues.find(ve => ve.id === v);
                    if (venue?.capacity) setCapacity(venue.capacity.toString());
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                    <SelectContent>
                      {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Capacity</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Max Students</Label>
                      <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Pricing</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Per Day (£)</Label>
                      <Input type="number" step="0.01" value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} placeholder="e.g. 35" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Total / Full Camp (£)</Label>
                      <Input type="number" step="0.01" value={priceTotal} onChange={e => setPriceTotal(e.target.value)} placeholder="e.g. 150" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Sibling discount applies (10% off for second child onwards)</p>
                      <p className="text-xs text-muted-foreground">Applied automatically at checkout to children's items when booking for more than one child.</p>
                    </div>
                    <Switch checked={siblingDiscountEnabled} onCheckedChange={setSiblingDiscountEnabled} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                    Next: Dates <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Date range */}
            {step === 2 && (
              <div className="space-y-4">
                {/* School holiday quick picks */}
                {schoolHolidays.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Quick Pick: School Holidays</Label>
                    <p className="text-xs text-muted-foreground">Select a holiday period, then toggle individual dates below</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {schoolHolidays.filter(h => !isBefore(parseISO(h.end_date), today)).map(h => {
                        const isSelected = selectedHolidayId === h.id;
                        const totalDays = eachDayOfInterval({ start: parseISO(h.start_date), end: parseISO(h.end_date) }).filter(d => !isWeekend(d)).length;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => selectHoliday(h)}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">{h.name}</span>
                              <Badge variant="outline" className="text-[10px]">{totalDays} weekdays</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(h.start_date), "d MMM")} – {format(parseISO(h.end_date), "d MMM yyyy")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Visual date calendar when a holiday is selected */}
                {selectedHolidayId && (() => {
                  const holiday = schoolHolidays.find(h => h.id === selectedHolidayId);
                  if (!holiday) return null;
                  const holidayStart = parseISO(holiday.start_date);
                  const holidayEnd = parseISO(holiday.end_date);
                  const allDays = eachDayOfInterval({ start: holidayStart, end: holidayEnd });
                  // Build a calendar grid month by month
                  const months: Date[] = [];
                  let current = startOfMonth(holidayStart);
                  const lastMonth = startOfMonth(holidayEnd);
                  while (!isBefore(lastMonth, current) || isSameMonth(current, lastMonth)) {
                    months.push(current);
                    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                    if (isBefore(lastMonth, current) && !isSameMonth(current, lastMonth)) break;
                    current = next;
                  }

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Select Camp Dates</Label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/15 text-primary border-primary/30">
                            {selectedDates.size} days selected
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const weekdays = allDays.filter(d => !isWeekend(d)).map(d => format(d, "yyyy-MM-dd"));
                              setSelectedDates(new Set(weekdays));
                            }}
                          >
                            Select all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setSelectedDates(new Set())}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {months.map(month => {
                          const monthStart = startOfMonth(month);
                          const monthEnd = endOfMonth(month);
                          const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                          const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                          const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

                          return (
                            <div key={format(month, "yyyy-MM")} className="rounded-lg border border-border bg-card/50 p-3">
                              <p className="text-sm font-semibold text-center mb-2">{format(month, "MMMM yyyy")}</p>
                              <div className="grid grid-cols-7 gap-0.5">
                                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                                  <div key={i} className="text-[10px] text-center text-muted-foreground font-medium py-1">{d}</div>
                                ))}
                                {calDays.map((day, i) => {
                                  const dateStr = format(day, "yyyy-MM-dd");
                                  const isInMonth = isSameMonth(day, month);
                                  const isInHoliday = allDays.some(d => isSameDay(d, day));
                                  const isWeekendDay = isWeekend(day);
                                  const isSelected = selectedDates.has(dateStr);
                                  const isClickable = isInMonth && isInHoliday;

                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      disabled={!isClickable}
                                      onClick={() => isClickable && toggleDate(dateStr)}
                                      className={`h-8 w-full rounded text-xs font-medium transition-all ${
                                        !isInMonth
                                          ? "text-transparent cursor-default"
                                          : !isInHoliday
                                          ? "text-muted-foreground/40 cursor-default"
                                          : isSelected
                                          ? "bg-primary text-primary-foreground hover:bg-primary/80 shadow-sm"
                                          : isWeekendDay
                                          ? "text-muted-foreground/50 hover:bg-muted/60 border border-dashed border-muted-foreground/20"
                                          : "text-muted-foreground hover:bg-muted/60 border border-dashed border-border"
                                      }`}
                                    >
                                      {isInMonth ? format(day, "d") : ""}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-border pt-4">
                  <Label className="text-sm font-semibold mb-3 block">
                    {selectedHolidayId ? "Or Use Custom Dates" : "Custom Dates"}
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Start Date *</Label>
                      <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedHolidayId(null); setSelectedDates(new Set()); }} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">End Date *</Label>
                      <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedHolidayId(null); setSelectedDates(new Set()); }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Start Time</Label>
                    <Input type="time" value={defaultStartTime} onChange={e => { setDefaultStartTime(e.target.value); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default End Time</Label>
                    <Input type="time" value={defaultEndTime} onChange={e => { setDefaultEndTime(e.target.value); }} />
                  </div>
                </div>

                {(() => {
                  const expectedDates = selectedDates.size > 0
                    ? Array.from(selectedDates).sort()
                    : (startDate && endDate && !isBefore(parseISO(endDate), parseISO(startDate))
                        ? eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).map(d => format(d, "yyyy-MM-dd"))
                        : []);
                  const currentDates = sessions.map(s => s.date).sort();
                  const datesMatch = expectedDates.length === currentDates.length && expectedDates.every((d, i) => d === currentDates[i]);
                  const timesMatch = sessions.every(s => s.start_time === defaultStartTime && s.end_time === defaultEndTime);
                  const inSync = sessions.length > 0 && datesMatch && timesMatch;
                  const canGenerate = expectedDates.length > 0;
                  if (inSync) {
                    return (
                      <p className="text-sm text-muted-foreground">{sessions.length} session(s) generated — click Next to review and customise per day.</p>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      <Button variant="outline" onClick={generateSessions} disabled={!canGenerate}>
                        {sessions.length > 0 ? "Regenerate Sessions" : "Generate Sessions"} ({expectedDates.length} days)
                      </Button>
                      {sessions.length > 0 && !timesMatch && (
                        <p className="text-xs text-muted-foreground">Default times changed — regenerating will reset any per-day time overrides.</p>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => { if (selectedDates.size > 0 && sessions.length === 0) generateSessions(); setStep(3); }} disabled={!canProceedStep2}>
                    Next: Review <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Review Sessions */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{sessions.length} Sessions</h3>
                    <p className="text-xs text-muted-foreground">Edit times per session or remove days</p>
                  </div>
                  {selectedWorkshop && <Badge variant="outline">{selectedWorkshop.name}</Badge>}
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                  {sessions.map((s, i) => (
                    <div key={s.date} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{s.dayLabel}</span>
                      </div>
                      <Input type="time" value={s.start_time} onChange={e => updateSessionTime(i, "start_time", e.target.value)} className="w-28" />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input type="time" value={s.end_time} onChange={e => updateSessionTime(i, "end_time", e.target.value)} className="w-28" />
                      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setSessions(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep(4)} disabled={sessions.length === 0}>
                    Next: Staffing <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Staffing */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Default Instructors</h3>
                  <p className="text-xs text-muted-foreground">Assign one or more instructors. Mark exactly one as Main; the rest are Assistants. Optionally set a pay-per-hour override per instructor. These apply for all days, then override individually below.</p>
                </div>

                <div className="space-y-2">
                  {instructorIds.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No instructors assigned yet.</p>
                  )}
                  {instructorIds.map(id => {
                    const s = staffList.find(st => st.id === id);
                    if (!s) return null;
                    const isMain = (mainInstructorId || instructorIds[0]) === id;
                    return (
                      <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 flex-wrap">
                        <span className="text-sm font-medium text-foreground flex-1 min-w-[120px]">{s.full_name}</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={isMain ? "default" : "outline"}
                            className="h-7 px-2 text-xs"
                            onClick={() => setMainInstructorId(id)}
                          >
                            Main
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!isMain ? "secondary" : "outline"}
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              // Demoting the current main: promote another instructor to main
                              if (isMain) {
                                const other = instructorIds.find(x => x !== id);
                                if (other) setMainInstructorId(other);
                              }
                            }}
                          >
                            Assistant
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">£/hr</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={s.pay_per_hour != null ? s.pay_per_hour.toString() : "default"}
                            value={instructorPayOverrides[id] ?? ""}
                            onChange={e => setInstructorPayOverrides(prev => ({ ...prev, [id]: e.target.value }))}
                            className="w-24 h-7 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInstructorIds(prev => prev.filter(i => i !== id));
                            setInstructorPayOverrides(prev => { const next = { ...prev }; delete next[id]; return next; });
                            if (mainInstructorId === id) {
                              const other = instructorIds.find(x => x !== id);
                              setMainInstructorId(other || "");
                            }
                          }}
                          className="hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  <Select value="" onValueChange={(v) => {
                    if (v && !instructorIds.includes(v)) {
                      setInstructorIds(prev => [...prev, v]);
                      // First instructor added becomes Main by default
                      if (instructorIds.length === 0 && !mainInstructorId) setMainInstructorId(v);
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Add instructor..." /></SelectTrigger>
                    <SelectContent>
                      {staffList.filter(s => !instructorIds.includes(s.id)).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold text-foreground mb-1">Per-Day Overrides</h3>
                  <p className="text-xs text-muted-foreground mb-3">Leave blank to use the default instructors above</p>

                  <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                    {sessions.map((s, i) => {
                      const overrideIds = sessionStaffing[i] || [];
                      const usingDefault = overrideIds.length === 0;
                      return (
                        <div key={s.date} className={`flex items-center gap-3 p-3 rounded-lg border ${usingDefault ? 'border-border bg-card/50' : 'border-primary/30 bg-primary/5'}`}>
                          <div className="w-48 flex-shrink-0">
                            <span className="text-sm font-medium text-foreground">{s.dayLabel}</span>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                            {usingDefault ? (
                              <span className="text-xs text-muted-foreground italic">Using defaults</span>
                            ) : (
                              overrideIds.map(sid => {
                                const staff = staffList.find(st => st.id === sid);
                                return staff ? (
                                  <Badge key={sid} variant="outline" className="gap-1 pr-1 text-xs">
                                    {staff.full_name}
                                    <button type="button" onClick={() => setSessionStaffing(prev => ({
                                      ...prev,
                                      [i]: prev[i].filter(id => id !== sid)
                                    }))} className="ml-0.5 hover:text-destructive">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </Badge>
                                ) : null;
                              })
                            )}
                          </div>
                          <Select value="" onValueChange={(v) => {
                            if (!v) return;
                            setSessionStaffing(prev => ({
                              ...prev,
                              [i]: [...(prev[i] || []), v].filter((id, idx, arr) => arr.indexOf(id) === idx)
                            }));
                          }}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Override..." />
                            </SelectTrigger>
                            <SelectContent>
                              {staffList.filter(st => !(sessionStaffing[i] || []).includes(st.id)).map(st => (
                                <SelectItem key={st.id} value={st.id}>{st.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!usingDefault && (
                            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setSessionStaffing(prev => {
                              const next = { ...prev };
                              delete next[i];
                              return next;
                            })}>
                              <X className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving || sessions.length === 0}>
                    {saving ? "Saving..." : editing ? "Update Camp" : "Create Camp"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant={!showPast ? "default" : "outline"} size="sm" onClick={() => setShowPast(false)}>Upcoming</Button>
        <Button variant={showPast ? "default" : "outline"} size="sm" onClick={() => setShowPast(true)}>Past</Button>
      </div>

      {/* Camp list */}
      {filteredCamps.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {showPast ? "past" : "upcoming"} camps found</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredCamps.map(c => {
          const isExpanded = expandedCampId === c.id;
          const toggleExpand = () => setExpandedCampId(isExpanded ? null : c.id);
          const sessionCount = campSessionCounts[c.id] || 0;
          const instrIds = campInstructors[c.id] || [];

          return (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                  <div className="flex items-start gap-3 lg:gap-4 min-w-0 flex-1">
                  {c.workshops?.cover_image && (
                    <img src={c.workshops.cover_image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{c.name}</h3>
                      <Badge variant="outline" className="text-xs">{c.class_type === "children" ? "Children" : "Adult"}</Badge>
                      {c.dance_style && <Badge variant="secondary" className="text-xs">{c.dance_style}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {c.venues?.name && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.venues.name}</span>
                      )}
                      {c.start_date && c.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(c.start_date), "d MMM")} – {format(parseISO(c.end_date), "d MMM yyyy")}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {sessionCount} day(s)</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Cap: {c.capacity}</span>
                    </div>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-3 flex-wrap justify-end border-t lg:border-t-0 border-border/40 pt-3 lg:pt-0">
                    {c.price_per_day && <span className="text-sm font-medium">£{c.price_per_day}/day</span>}
                    {c.price_total && <span className="text-sm text-muted-foreground">£{c.price_total} total</span>}
                    <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={() => openClone(c)}>
                      <Copy className="w-4 h-4" />
                      <span className="text-[9px] text-muted-foreground">Clone</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={() => openEdit(c)}>
                      <Edit className="w-4 h-4" />
                      <span className="text-[9px] text-muted-foreground">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <span className="text-[9px] text-destructive">Delete</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={toggleExpand}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="text-[9px] text-muted-foreground">{isExpanded ? "Less" : "More"}</span>
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                    {instrIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Staff:</span>
                        {instrIds.map(id => {
                          const s = staffList.find(st => st.id === id);
                          return s ? <Badge key={id} variant="outline" className="text-xs">{s.full_name}</Badge> : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Camp?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the camp and all its sessions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCamps;
