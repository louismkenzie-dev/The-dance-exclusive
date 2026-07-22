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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, CalendarDays, ChevronRight, ChevronLeft, ListChecks, ChevronDown, ChevronUp, Clock, User, Archive, X, Copy, Flag, AlertTriangle } from "lucide-react";
import SessionManager from "@/components/admin/SessionManager";
import { AssignStaffDialog } from "@/components/admin/AssignStaffDialog";
import { format, addDays, parseISO, eachDayOfInterval, getDay, isBefore, isWithinInterval } from "date-fns";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_INDEX_MAP: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

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
  duration_minutes: number | null;
  price: number | null;
}

const ABILITY_LEVELS = ["Beginner", "Improver", "Intermediate", "Advanced", "All Levels"] as const;

// Add `minutes` to an HH:MM time string, returning HH:MM (clamped to 23:59 if it overflows the day).
const addMinutesToTime = (time: string, minutes: number): string => {
  if (!time || !time.includes(":")) return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  let total = h * 60 + m + minutes;
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;
  if (total < 0) total = 0;
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

// Difference in minutes between two HH:MM times (end - start). Returns 0 if invalid.
const minutesBetween = (start: string, end: string): number => {
  if (!start || !end || !start.includes(":") || !end.includes(":")) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return (eh * 60 + em) - (sh * 60 + sm);
};

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  class_type: string;
  dance_style: string | null;
  age_min: number | null;
  age_max: number | null;
  ability_level: string | null;
  gender: string | null;
  capacity: number;
  price_per_session: number | null;
  price_per_term: number | null;
  venue_id: string | null;
  instructor_id: string | null;
  workshop_id: string | null;
  day_of_week: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  term_start: string | null;
  term_end: string | null;
  is_active: boolean;
  venues?: { name: string } | null;
  staff?: { full_name: string } | null;
  workshops?: { name: string; cover_image: string | null } | null;
}

interface SessionRow {
  date: string;
  dayLabel: string;
  start_time: string;
  end_time: string;
}

interface SchoolTermData {
  id: string;
  name: string;
  term_type: string;
  academic_year: string;
  start_date: string;
  end_date: string;
}

interface BankHolidayData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface ClassSessionData {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  instructor_id: string | null;
  staff?: { full_name: string } | null;
}

const AdminClasses = () => {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; capacity: number | null }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [sessionsClassId, setSessionsClassId] = useState<string | null>(null);
  const [staffDialogClass, setStaffDialogClass] = useState<{ id: string; name: string } | null>(null);
  const [sessionsClassName, setSessionsClassName] = useState("");
  const [sessionsInstructorIds, setSessionsInstructorIds] = useState<string[]>([]);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [classSessions, setClassSessions] = useState<Record<string, ClassSessionData[]>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [typeFilter, setTypeFilter] = useState<"all" | "children" | "adult">("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);
  const [schoolTerms, setSchoolTerms] = useState<SchoolTermData[]>([]);
  const [bankHolidays, setBankHolidays] = useState<BankHolidayData[]>([]);
  const { toast } = useToast();

  const getMediaUrl = (path: string) => {
    const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
    return data.publicUrl;
  };

  // Form state
  const [classType, setClassType] = useState<"children" | "adult">("children");
  const [workshopId, setWorkshopId] = useState("");
  const [abilityLevel, setAbilityLevel] = useState<string>("");
  const [gender, setGender] = useState<string>("mixed");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [venueId, setVenueId] = useState("");
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [mainInstructorId, setMainInstructorId] = useState<string>("");
  const [instructorPayOverrides, setInstructorPayOverrides] = useState<Record<string, string>>({});
  const [classInstructors, setClassInstructors] = useState<Record<string, string[]>>({});
  const [classInstructorDetails, setClassInstructorDetails] = useState<Record<string, { staff_id: string; instructor_role: string; pay_per_hour_override: number | null }[]>>({});
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [defaultEndTime, setDefaultEndTime] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [pricePerSession, setPricePerSession] = useState("");
  const [pricePerTerm, setPricePerTerm] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [pricePerYear, setPricePerYear] = useState("");
  const [termDiscountPercent, setTermDiscountPercent] = useState("");
  const [yearDiscountPercent, setYearDiscountPercent] = useState("");
  const [termDiscountAmount, setTermDiscountAmount] = useState("");
  const [yearDiscountAmount, setYearDiscountAmount] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionStaffing, setSessionStaffing] = useState<Record<number, string[]>>({});
  const [allowTrial, setAllowTrial] = useState(false);
  const [audienceLabel, setAudienceLabel] = useState("");
  const [schoolYearMin, setSchoolYearMin] = useState("");
  const [schoolYearMax, setSchoolYearMax] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [classStatus, setClassStatus] = useState("confirmed");
  const [publiclyVisible, setPubliclyVisible] = useState(true);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [siblingDiscountEnabled, setSiblingDiscountEnabled] = useState(true);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");

  const filteredWorkshops = useMemo(() => 
    workshops.filter(w => w.class_type === classType).sort((a, b) => a.name.localeCompare(b.name)),
    [workshops, classType]
  );
  const selectedWorkshop = useMemo(() => workshops.find(w => w.id === workshopId), [workshops, workshopId]);

  const today = new Date();
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // Type filter
      if (typeFilter !== "all" && c.class_type !== typeFilter) return false;
      // Venue filter
      if (venueFilter !== "all" && c.venue_id !== venueFilter) return false;
      // Past vs active
      const isPast = c.term_end ? isBefore(parseISO(c.term_end), today) : !c.is_active;
      if (showPast) return isPast;
      return !isPast;
    });
  }, [classes, typeFilter, venueFilter, showPast]);

  const fetchData = async () => {
    const [classesRes, venuesRes, staffRes, workshopsRes, termsRes, holidaysRes] = await Promise.all([
      supabase.from("classes").select("*, venues(name), staff(full_name), workshops(name, cover_image)").order("created_at", { ascending: false }),
      supabase.from("venues").select("id, name, capacity").eq("is_active", true),
      supabase.from("staff").select("id, full_name").eq("is_active", true),
      supabase.from("workshops").select("id, name, description, theme, dance_style, class_type, age_min, age_max, cover_image, capacity, duration_minutes, price").eq("is_active", true),
      supabase.from("school_terms").select("*").order("start_date"),
      supabase.from("school_holidays").select("*").eq("holiday_type", "bank_holiday").order("start_date"),
    ]);
    if (classesRes.data) setClasses(classesRes.data as any);
    if (venuesRes.data) setVenues(venuesRes.data);
    if (staffRes.data) setStaffList(staffRes.data);
    if (workshopsRes.data) setWorkshops(workshopsRes.data as any);
    if (termsRes.data) setSchoolTerms(termsRes.data as SchoolTermData[]);
    if (holidaysRes.data) setBankHolidays(holidaysRes.data as BankHolidayData[]);

    // Fetch session counts and class instructors for all classes
    if (classesRes.data) {
      const ids = classesRes.data.map((c: any) => c.id);
      const [sessionsRes, instructorsRes] = await Promise.all([
        supabase.from("class_sessions").select("class_id").in("class_id", ids),
        supabase.from("class_instructors").select("class_id, staff_id, instructor_role, pay_per_hour_override").in("class_id", ids),
      ]);
      if (sessionsRes.data) {
        const counts: Record<string, number> = {};
        sessionsRes.data.forEach((s: any) => { counts[s.class_id] = (counts[s.class_id] || 0) + 1; });
        setSessionCounts(counts);
      }
      if (instructorsRes.data) {
        const map: Record<string, string[]> = {};
        const details: Record<string, { staff_id: string; instructor_role: string; pay_per_hour_override: number | null }[]> = {};
        instructorsRes.data.forEach((r: any) => {
          if (!map[r.class_id]) map[r.class_id] = [];
          map[r.class_id].push(r.staff_id);
          if (!details[r.class_id]) details[r.class_id] = [];
          details[r.class_id].push({
            staff_id: r.staff_id,
            instructor_role: r.instructor_role || "assistant",
            pay_per_hour_override: r.pay_per_hour_override,
          });
        });
        setClassInstructors(map);
        setClassInstructorDetails(details);
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setClassType("children");
    setWorkshopId("");
    setAbilityLevel("");
    setGender("mixed");
    setDurationMinutes("60");
    setVenueId("");
    setInstructorIds([]);
    setMainInstructorId("");
    setInstructorPayOverrides({});
    setSelectedTermIds([]);
    setSelectedDays([]);
    setTermStart("");
    setTermEnd("");
    setDefaultStartTime("09:00");
    setDefaultEndTime("10:00");
    setCapacity("20");
    setPricePerSession("");
    setPricePerTerm("");
    setPricePerMonth("");
    setPricePerYear("");
    setTermDiscountPercent("");
    setYearDiscountPercent("");
    setTermDiscountAmount("");
    setYearDiscountAmount("");
    setSessions([]);
    setSessionStaffing({});
    setAllowTrial(false);
    setAudienceLabel("");
    setSchoolYearMin("");
    setSchoolYearMax("");
    setInviteOnly(false);
    setClassStatus("confirmed");
    setPubliclyVisible(true);
    setBookingEnabled(true);
    setSiblingDiscountEnabled(true);
    setWhatsappGroupUrl("");
    setEditing(null);
    setStep(1);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleTerm = (termId: string) => {
    setSelectedTermIds(prev => prev.includes(termId) ? prev.filter(id => id !== termId) : [...prev, termId]);
  };

  // Filter terms: only show future or current terms
  const availableTerms = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return schoolTerms.filter(t => t.end_date >= todayStr);
  }, [schoolTerms]);

  // Group available terms by academic year
  const termsByYear = useMemo(() => {
    const grouped: Record<string, SchoolTermData[]> = {};
    availableTerms.forEach(t => {
      if (!grouped[t.academic_year]) grouped[t.academic_year] = [];
      grouped[t.academic_year].push(t);
    });
    return grouped;
  }, [availableTerms]);

  // Bank holidays falling within selected terms
  const bankHolidaysInSelection = useMemo(() => {
    if (selectedTermIds.length === 0) return [];
    const selectedTerms = schoolTerms.filter(t => selectedTermIds.includes(t.id));
    return bankHolidays.filter(bh => {
      const bhDate = parseISO(bh.start_date);
      return selectedTerms.some(t =>
        isWithinInterval(bhDate, { start: parseISO(t.start_date), end: parseISO(t.end_date) })
      );
    });
  }, [selectedTermIds, schoolTerms, bankHolidays]);

  // Bank holiday date set for quick lookup
  const bankHolidayDates = useMemo(() => {
    return new Set(bankHolidays.map(bh => bh.start_date));
  }, [bankHolidays]);

  // Compute effective term start/end from selected terms
  useEffect(() => {
    if (selectedTermIds.length === 0) {
      setTermStart("");
      setTermEnd("");
      return;
    }
    const selectedTerms = schoolTerms.filter(t => selectedTermIds.includes(t.id));
    const starts = selectedTerms.map(t => t.start_date).sort();
    const ends = selectedTerms.map(t => t.end_date).sort();
    setTermStart(starts[0]);
    setTermEnd(ends[ends.length - 1]);
  }, [selectedTermIds, schoolTerms]);

  // Generate sessions from selected terms + days, excluding bank holidays
  const generateSessions = () => {
    if (selectedTermIds.length === 0 || selectedDays.length === 0) {
      setSessions([]);
      return;
    }
    const selectedTerms = schoolTerms.filter(t => selectedTermIds.includes(t.id));
    const dayIndices = selectedDays.map(d => DAY_INDEX_MAP[d]);
    const allSessions: SessionRow[] = [];

    for (const term of selectedTerms) {
      const start = parseISO(term.start_date);
      const end = parseISO(term.end_date);
      const allDays = eachDayOfInterval({ start, end });
      const matching = allDays.filter(d => {
        if (!dayIndices.includes(getDay(d))) return false;
        // Exclude bank holidays
        const dateStr = format(d, "yyyy-MM-dd");
        if (bankHolidayDates.has(dateStr)) return false;
        return true;
      });
      allSessions.push(...matching.map(d => ({
        date: format(d, "yyyy-MM-dd"),
        dayLabel: format(d, "EEEE, d MMM yyyy"),
        start_time: defaultStartTime,
        end_time: defaultEndTime,
      })));
    }

    // Sort by date
    allSessions.sort((a, b) => a.date.localeCompare(b.date));
    setSessions(allSessions);
  };

  useEffect(() => {
    if (step === 2 || step === 3) generateSessions();
  }, [selectedTermIds, selectedDays, defaultStartTime, defaultEndTime, step]);

  // Auto-compute end time = start + duration whenever the start time or duration changes.
  // (End time stays editable; the input's own onChange validates that it is after start.)
  useEffect(() => {
    const mins = parseInt(durationMinutes);
    if (!defaultStartTime || Number.isNaN(mins) || mins <= 0) return;
    setDefaultEndTime(addMinutesToTime(defaultStartTime, mins));
  }, [defaultStartTime, durationMinutes]);

  const updateSessionTime = (index: number, field: "start_time" | "end_time", value: string) => {
    setSessions(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === "start_time") {
        // Changing the start auto-recomputes the end from the class duration
        const mins = parseInt(durationMinutes) || 60;
        return { ...s, start_time: value, end_time: addMinutesToTime(value, mins) };
      }
      return { ...s, end_time: value };
    }));
  };

  // Validate/auto-correct a single session's end time to be after its start
  const validateSessionEnd = (index: number) => {
    setSessions(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (minutesBetween(s.start_time, s.end_time) <= 0) {
        const mins = parseInt(durationMinutes) || 60;
        return { ...s, end_time: addMinutesToTime(s.start_time, mins) };
      }
      return s;
    }));
  };

  const populateForm = (c: ClassData, isEdit: boolean) => {
    if (isEdit) setEditing(c); else setEditing(null);
    setClassType((c.class_type as "children" | "adult") || "children");
    setWorkshopId(c.workshop_id || "");
    setAbilityLevel(c.ability_level || "");
    setGender(c.gender || "mixed");
    setVenueId(c.venue_id || "");
    // Instructors + roles + pay overrides
    const details = classInstructorDetails[c.id] || [];
    const ids = details.length > 0
      ? details.map(d => d.staff_id)
      : (classInstructors[c.id] || (c.instructor_id ? [c.instructor_id] : []));
    setInstructorIds(ids);
    const main = details.find(d => d.instructor_role === "main");
    setMainInstructorId(main?.staff_id || ids[0] || "");
    const payMap: Record<string, string> = {};
    details.forEach(d => {
      if (d.pay_per_hour_override != null) payMap[d.staff_id] = d.pay_per_hour_override.toString();
    });
    setInstructorPayOverrides(payMap);
    setSelectedDays(c.days_of_week?.length ? c.days_of_week : [c.day_of_week]);
    // Try to match existing term dates to school terms
    if (c.term_start && c.term_end) {
      const matchingTerms = schoolTerms.filter(t =>
        t.start_date >= c.term_start! && t.end_date <= c.term_end!
      );
      setSelectedTermIds(matchingTerms.map(t => t.id));
    } else {
      setSelectedTermIds([]);
    }
    setTermStart(c.term_start || "");
    setTermEnd(c.term_end || "");
    const startT = c.start_time?.slice(0, 5) || "09:00";
    const endT = c.end_time?.slice(0, 5) || "10:00";
    setDefaultStartTime(startT);
    setDefaultEndTime(endT);
    // Derive duration from saved times, falling back to the workshop's default
    const derived = minutesBetween(startT, endT);
    if (derived > 0) {
      setDurationMinutes(derived.toString());
    } else {
      const ws = workshops.find(w => w.id === c.workshop_id);
      setDurationMinutes((ws?.duration_minutes ?? 60).toString());
    }
    setCapacity(c.capacity.toString());
    setPricePerSession(c.price_per_session?.toString() || "");
    setPricePerTerm(c.price_per_term?.toString() || "");
    setPricePerMonth((c as any).price_per_month?.toString() || "");
    setPricePerYear((c as any).price_per_year?.toString() || "");
    setTermDiscountPercent((c as any).term_discount_percent?.toString() || "");
    setYearDiscountPercent((c as any).year_discount_percent?.toString() || "");
    setTermDiscountAmount((c as any).term_discount_amount?.toString() || "");
    setYearDiscountAmount((c as any).year_discount_amount?.toString() || "");
    setAllowTrial((c as any).allow_trial ?? false);
    setAudienceLabel((c as any).audience_label || "");
    setSchoolYearMin((c as any).school_year_min?.toString() || "");
    setSchoolYearMax((c as any).school_year_max?.toString() || "");
    setInviteOnly((c as any).invite_only ?? false);
    setClassStatus((c as any).status || "confirmed");
    setPubliclyVisible((c as any).publicly_visible ?? true);
    setBookingEnabled((c as any).booking_enabled ?? true);
    setSiblingDiscountEnabled((c as any).sibling_discount_enabled ?? true);
    setWhatsappGroupUrl((c as any).whatsapp_group_url || "");
    setStep(1);
    setOpen(true);
  };

  const openEdit = (c: ClassData) => populateForm(c, true);
  const openClone = (c: ClassData) => populateForm(c, false);

  const handleSubmit = async () => {
    if (!selectedWorkshop) return;
    setSaving(true);

    const payload: any = {
      name: selectedWorkshop.name,
      description: selectedWorkshop.description,
      class_type: selectedWorkshop.class_type as any,
      dance_style: selectedWorkshop.dance_style,
      age_min: selectedWorkshop.age_min,
      age_max: selectedWorkshop.age_max,
      workshop_id: workshopId || null,
      ability_level: abilityLevel || null,
      gender: gender || "mixed",
      venue_id: venueId || null,
      instructor_id: mainInstructorId || instructorIds[0] || null,
      days_of_week: selectedDays,
      day_of_week: selectedDays[0] || "monday",
      start_time: defaultStartTime,
      end_time: defaultEndTime,
      term_start: termStart || null,
      term_end: termEnd || null,
      capacity: parseInt(capacity) || 20,
      price_per_session: pricePerSession ? parseFloat(pricePerSession) : null,
      price_per_term: pricePerTerm ? parseFloat(pricePerTerm) : null,
      price_per_month: pricePerMonth ? parseFloat(pricePerMonth) : null,
      price_per_year: pricePerYear ? parseFloat(pricePerYear) : null,
      term_discount_percent: termDiscountPercent ? parseFloat(termDiscountPercent) : 0,
      year_discount_percent: yearDiscountPercent ? parseFloat(yearDiscountPercent) : 0,
      term_discount_amount: termDiscountAmount ? parseFloat(termDiscountAmount) : null,
      year_discount_amount: yearDiscountAmount ? parseFloat(yearDiscountAmount) : null,
      allow_trial: allowTrial,
      audience_label: audienceLabel || null,
      school_year_min: schoolYearMin ? parseInt(schoolYearMin) : null,
      school_year_max: schoolYearMax ? parseInt(schoolYearMax) : null,
      invite_only: inviteOnly,
      status: classStatus,
      publicly_visible: publiclyVisible,
      // Invite-only sessions must never behave like open-enrolment classes.
      booking_enabled: inviteOnly ? false : bookingEnabled,
      sibling_discount_enabled: siblingDiscountEnabled,
      whatsapp_group_url: whatsappGroupUrl.trim() || null,
    };

    if (payload.school_year_min != null && payload.school_year_max != null && payload.school_year_min > payload.school_year_max) {
      toast({ title: "Invalid school years", description: "Minimum school year cannot be above the maximum.", variant: "destructive" });
      setSaving(false);
      return;
    }

    let classId: string;

    if (editing) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      classId = editing.id;
      // Delete old sessions and re-create
      await supabase.from("class_sessions").delete().eq("class_id", classId);
    } else {
      const { data, error } = await supabase.from("classes").insert(payload).select("id").single();
      if (error || !data) {
        toast({ title: "Error", description: error?.message || "Failed to create class", variant: "destructive" });
        setSaving(false);
        return;
      }
      classId = data.id;
    }

    // Insert sessions with instructor overrides
    if (sessions.length > 0) {
      const sessionRows = sessions.map((s, i) => ({
        class_id: classId,
        session_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        instructor_id: sessionStaffing[i]?.[0] || instructorIds[0] || null,
      }));
      const { data: insertedSessions, error: sessError } = await supabase.from("class_sessions").insert(sessionRows).select("id");
      if (sessError) {
        toast({ title: "Warning", description: `Class saved but sessions failed: ${sessError.message}`, variant: "destructive" });
      }

      // Save session-level instructor assignments
      if (insertedSessions) {
        const sessionInstructorRows: { session_id: string; staff_id: string }[] = [];
        insertedSessions.forEach((sess, i) => {
          const staffIds = sessionStaffing[i] && sessionStaffing[i].length > 0 ? sessionStaffing[i] : instructorIds;
          staffIds.forEach(sid => {
            sessionInstructorRows.push({ session_id: sess.id, staff_id: sid });
          });
        });
        if (sessionInstructorRows.length > 0) {
          await supabase.from("session_instructors").insert(sessionInstructorRows);
        }
      }
    }

    // Save class instructors with role (exactly one main) + optional pay override
    await supabase.from("class_instructors").delete().eq("class_id", classId);
    if (instructorIds.length > 0) {
      // Ensure exactly one main: fall back to the first instructor if the marked main isn't in the list
      const resolvedMain = instructorIds.includes(mainInstructorId) ? mainInstructorId : instructorIds[0];
      await supabase.from("class_instructors").insert(
        instructorIds.map(sid => {
          const override = instructorPayOverrides[sid];
          return {
            class_id: classId,
            staff_id: sid,
            instructor_role: sid === resolvedMain ? "main" : "assistant",
            pay_per_hour_override: override !== undefined && override !== "" ? parseFloat(override) : null,
          };
        })
      );
    }

    toast({ title: editing ? "Class updated" : "Class created" });
    setOpen(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("classes").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Class deleted" }); fetchData(); }
    setDeleteId(null);
  };

  const canProceedStep1 = !!workshopId && !!abilityLevel;
  const canProceedStep2 = selectedDays.length > 0 && selectedTermIds.length > 0;
  const canProceedStep3 = sessions.length > 0;
  // Pricing step has no hard requirement; you can always continue to staffing
  const canProceedStep4 = true;

  // Pricing rule suggestions derived from the per-session price:
  // monthly = session × 3.4 (38 dance weeks Sept–July ÷ months), yearly = session × 38 × 0.90, term = session × sessions-in-term × 0.95.
  const sessionPriceNum = parseFloat(pricePerSession);
  const hasSessionPrice = !Number.isNaN(sessionPriceNum) && sessionPriceNum > 0;
  const monthlySuggestion = hasSessionPrice ? (sessionPriceNum * 3.4).toFixed(2) : "";
  const yearlySuggestion = hasSessionPrice ? (sessionPriceNum * 38 * 0.9).toFixed(2) : "";
  // Sessions per term from the wizard's generated sessions (averaged when several terms are selected)
  const sessionsPerTerm = sessions.length > 0
    ? Math.round(sessions.length / Math.max(selectedTermIds.length, 1))
    : 0;
  const termSuggestion = hasSessionPrice && sessionsPerTerm > 0
    ? (sessionPriceNum * sessionsPerTerm * 0.95).toFixed(2)
    : "";

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">Manage dance classes & sessions</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Class</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Class" : "New Class"}</DialogTitle>
            </DialogHeader>

            {/* Step indicators - clickable */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(s => {
                const canNavigate =
                  s === 1 ||
                  (s === 2 && canProceedStep1) ||
                  (s === 3 && canProceedStep1 && canProceedStep2) ||
                  (s === 4 && canProceedStep1 && canProceedStep2 && canProceedStep3) ||
                  (s === 5 && canProceedStep1 && canProceedStep2 && canProceedStep3 && canProceedStep4);
                const labels: Record<number, string> = { 1: "Type of Class & Details", 2: "Schedule", 3: "Review Sessions", 4: "Pricing", 5: "Staffing" };
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
                    {s < 5 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Workshop, Venue, Instructor, Pricing */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Class Type *</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={classType === "children" ? "default" : "outline"} onClick={() => { setClassType("children"); setWorkshopId(""); }}>Children</Button>
                    <Button type="button" variant={classType === "adult" ? "default" : "outline"} onClick={() => { setClassType("adult"); setWorkshopId(""); }}>Adult</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type of Class *</Label>
                  <Select value={workshopId} onValueChange={(v) => {
                    setWorkshopId(v);
                    const ws = workshops.find(w => w.id === v);
                    // Prefill duration from the selected type of class (overridable below)
                    if (ws?.duration_minutes) setDurationMinutes(ws.duration_minutes.toString());
                    // Prefill per-session price from the type of class's default price
                    if (ws?.price != null) setPricePerSession(ws.price.toString());
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choose a type of class..." /></SelectTrigger>
                    <SelectContent>
                      {filteredWorkshops.map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} {w.dance_style ? `(${w.dance_style})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredWorkshops.length === 0 && (
                    <p className="text-xs text-amber-500">
                      No {classType} class types exist yet — create one under Admin → Type of Class first, then come back here.
                    </p>
                  )}
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
                  <Label>WhatsApp group link</Label>
                  <Input
                    type="url"
                    value={whatsappGroupUrl}
                    onChange={e => setWhatsappGroupUrl(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Parents with a confirmed booking see a "Join the class WhatsApp group" link in their portal.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ability Level (minimum) *</Label>
                    <Select value={abilityLevel} onValueChange={setAbilityLevel}>
                      <SelectTrigger><SelectValue placeholder="Select ability level" /></SelectTrigger>
                      <SelectContent>
                        {ABILITY_LEVELS.map(level => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boys">Boys</SelectItem>
                        <SelectItem value="girls">Girls</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value)}
                    placeholder="e.g. 60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefilled from the chosen type of class. Used to auto-calculate each session's end time.
                  </p>
                </div>

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
                  <Label className="text-sm font-semibold">Trial Session</Label>
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={allowTrial}
                      onCheckedChange={(checked) => setAllowTrial(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-foreground">Allow trial sessions</span>
                      <p className="text-xs text-muted-foreground">
                        New students can book a one-off trial charged at the single-session price.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <Label className="text-sm font-semibold">Audience & Access</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Audience Label</Label>
                      <Input value={audienceLabel} onChange={e => setAudienceLabel(e.target.value)} placeholder='e.g. "Ages 8–16", "O17", "Adults"' />
                      <p className="text-[11px] text-muted-foreground">Shown to parents. Overrides age/school-year display.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">School Year (min)</Label>
                      <Input type="number" min="0" max="13" value={schoolYearMin} onChange={e => setSchoolYearMin(e.target.value)} placeholder="e.g. 2" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">School Year (max)</Label>
                      <Input type="number" min="0" max="13" value={schoolYearMax} onChange={e => setSchoolYearMax(e.target.value)} placeholder="e.g. 6" />
                    </div>
                  </div>
                  {schoolYearMin !== "" && schoolYearMax !== "" && parseInt(schoolYearMin) > parseInt(schoolYearMax) && (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" /> Minimum school year cannot be above the maximum.
                    </div>
                  )}
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                    <Checkbox checked={inviteOnly} onCheckedChange={(v) => setInviteOnly(!!v)} className="mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-foreground">Invite only</span>
                      <p className="text-xs text-muted-foreground">
                        Shown on the public site with an invite-only message. Parents cannot book it themselves — booking is always disabled for invite-only sessions.
                      </p>
                    </div>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <Label className="text-xs">Status</Label>
                      <Select value={classStatus} onValueChange={setClassStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="provisional">Provisional</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">Only confirmed classes appear on the public site.</p>
                    </div>
                    <div className="flex items-center gap-3 pb-1">
                      <Switch checked={publiclyVisible} onCheckedChange={setPubliclyVisible} />
                      <Label className="text-xs">Publicly visible</Label>
                    </div>
                    <div className="flex items-center gap-3 pb-1">
                      <Switch checked={inviteOnly ? false : bookingEnabled} disabled={inviteOnly} onCheckedChange={setBookingEnabled} />
                      <Label className="text-xs">Booking enabled</Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                    Next: Schedule <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Term selection, days, default times */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Term Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Select School Terms *</Label>
                  <p className="text-xs text-muted-foreground">Choose one or more terms. Select all terms for a year-long class.</p>
                  {Object.keys(termsByYear).length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">No future terms found. Please add terms in Settings → Term Dates & Holidays first.</p>
                    </div>
                  ) : (
                    Object.entries(termsByYear).map(([year, terms]) => (
                      <div key={year} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{year}</p>
                        <div className="grid gap-2">
                          {terms.map(term => {
                            const isSelected = selectedTermIds.includes(term.id);
                            const termColor = term.term_type === 'autumn' ? 'border-amber-500/40 bg-amber-500/10' :
                              term.term_type === 'spring' ? 'border-emerald-500/40 bg-emerald-500/10' :
                              'border-sky-500/40 bg-sky-500/10';
                            return (
                              <label
                                key={term.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? `${termColor} ring-1 ring-primary/30`
                                    : 'border-border bg-card hover:border-primary/30'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleTerm(term.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium">{term.name}</span>
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(term.start_date), "d MMM yyyy")} – {format(parseISO(term.end_date), "d MMM yyyy")}
                                  </p>
                                </div>
                                <Badge variant="outline" className={term.term_type === 'autumn' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                                  term.term_type === 'spring' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
                                  'bg-sky-500/15 text-sky-500 border-sky-500/30'}>
                                  {term.term_type.charAt(0).toUpperCase() + term.term_type.slice(1)}
                                </Badge>
                              </label>
                            );
                          })}
                        </div>
                        {/* Select all for this year */}
                        {terms.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              const yearTermIds = terms.map(t => t.id);
                              const allSelected = yearTermIds.every(id => selectedTermIds.includes(id));
                              if (allSelected) {
                                setSelectedTermIds(prev => prev.filter(id => !yearTermIds.includes(id)));
                              } else {
                                setSelectedTermIds(prev => [...new Set([...prev, ...yearTermIds])]);
                              }
                            }}
                          >
                            {terms.every(t => selectedTermIds.includes(t.id)) ? "Deselect all" : "Select all"} {year}
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Bank Holiday Warning */}
                {bankHolidaysInSelection.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Flag className="h-4 w-4" />
                      <span className="text-sm font-medium">{bankHolidaysInSelection.length} bank holiday{bankHolidaysInSelection.length !== 1 ? 's' : ''} excluded</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bankHolidaysInSelection.map(bh => (
                        <Badge key={bh.id} variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                          {bh.name} ({format(parseISO(bh.start_date), "d MMM")})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Days of the Week */}
                <div className="space-y-2">
                  <Label>Days of the Week *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <label
                        key={day}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedDays.includes(day)
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <Checkbox
                          checked={selectedDays.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <span className="text-sm font-medium capitalize">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Times — admin sets START; END auto-computes from duration but stays editable */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Start Time</Label>
                    <Input type="time" value={defaultStartTime} onChange={e => setDefaultStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default End Time (auto)</Label>
                    <Input
                      type="time"
                      value={defaultEndTime}
                      onChange={e => setDefaultEndTime(e.target.value)}
                      onBlur={() => {
                        // Validate end is after start; auto-correct to start + duration otherwise
                        if (minutesBetween(defaultStartTime, defaultEndTime) <= 0) {
                          const mins = parseInt(durationMinutes) || 60;
                          setDefaultEndTime(addMinutesToTime(defaultStartTime, mins));
                        }
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  End time is calculated as start + {durationMinutes || "?"} min. You can override it, but it must be after the start time.
                </p>
                {minutesBetween(defaultStartTime, defaultEndTime) <= 0 && (
                  <div className="flex items-center gap-2 text-xs text-destructive -mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> End time must be after start time.
                  </div>
                )}

                {/* Session count summary */}
                {selectedTermIds.length > 0 && selectedDays.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm font-medium">
                      <CalendarDays className="w-4 h-4 inline mr-1" />
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''} will be generated
                      {selectedTermIds.length > 1 && ` across ${selectedTermIds.length} terms`}
                      {bankHolidaysInSelection.length > 0 && (
                        <span className="text-amber-500 ml-1">
                          ({bankHolidaysInSelection.length} bank holiday{bankHolidaysInSelection.length !== 1 ? 's' : ''} excluded)
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!canProceedStep2 || minutesBetween(defaultStartTime, defaultEndTime) <= 0}>
                    Next: Review Sessions <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Session preview & editing */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{sessions.length} Sessions</h3>
                    <p className="text-xs text-muted-foreground">Edit times per session if needed</p>
                  </div>
                  {selectedWorkshop && (
                    <Badge variant="outline">{selectedWorkshop.name}</Badge>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                  {sessions.map((s, i) => (
                    <div key={s.date} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{s.dayLabel}</span>
                      </div>
                      <Input
                        type="time"
                        value={s.start_time}
                        onChange={e => updateSessionTime(i, "start_time", e.target.value)}
                        className="w-28"
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="time"
                        value={s.end_time}
                        onChange={e => updateSessionTime(i, "end_time", e.target.value)}
                        onBlur={() => validateSessionEnd(i)}
                        className={`w-28 ${minutesBetween(s.start_time, s.end_time) <= 0 ? "border-destructive" : ""}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => setSessions(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {sessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No sessions generated. Go back and select days & date range.
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep(4)} disabled={sessions.length === 0 || sessions.some(s => minutesBetween(s.start_time, s.end_time) <= 0)}>
                    Next: Pricing <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Pricing */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-foreground">Pricing</h3>
                  <p className="text-xs text-muted-foreground">
                    Per-session price is prefilled from the type of class. Set the other options as needed.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Per Session (£)</Label>
                      <Input type="number" step="0.01" value={pricePerSession} onChange={e => setPricePerSession(e.target.value)} placeholder="e.g. 9" />
                      {classType === "children" && (
                        <p className="text-[11px] text-muted-foreground">
                          Children's classes can't be booked as drop-ins — this price is used for the paid trial and to derive plan prices.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Monthly Subscription (£)</Label>
                      <Input type="number" step="0.01" value={pricePerMonth} onChange={e => setPricePerMonth(e.target.value)} placeholder="e.g. 30" />
                      <p className="text-[11px] text-muted-foreground">
                        Monthly = session price × 3.4 (38 dance weeks Sept–July ÷ months, e.g. £9 → £30.60).
                      </p>
                      {!pricePerMonth && monthlySuggestion && (
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setPricePerMonth(monthlySuggestion)}>
                          Use £{monthlySuggestion}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Per Term (£)</Label>
                      <Input type="number" step="0.01" value={pricePerTerm} onChange={e => setPricePerTerm(e.target.value)} placeholder="e.g. 60" />
                      <p className="text-[11px] text-muted-foreground">
                        Term = session price × sessions in the term × 0.95 (5% off).
                      </p>
                      {!pricePerTerm && termSuggestion && (
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setPricePerTerm(termSuggestion)}>
                          Use £{termSuggestion}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Per Year (£)</Label>
                      <Input type="number" step="0.01" value={pricePerYear} onChange={e => setPricePerYear(e.target.value)} placeholder="e.g. 150" />
                      <p className="text-[11px] text-muted-foreground">
                        Yearly = session price × 38 × 0.90 (10% off — best deal).
                      </p>
                      {!pricePerYear && yearlySuggestion && (
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setPricePerYear(yearlySuggestion)}>
                          Use £{yearlySuggestion}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Term Discount %</Label>
                      <Input type="number" step="1" value={termDiscountPercent} onChange={e => setTermDiscountPercent(e.target.value)} placeholder="e.g. 10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Term Discount (£)</Label>
                      <Input type="number" step="0.01" value={termDiscountAmount} onChange={e => setTermDiscountAmount(e.target.value)} placeholder="e.g. 5" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Year Discount %</Label>
                      <Input type="number" step="1" value={yearDiscountPercent} onChange={e => setYearDiscountPercent(e.target.value)} placeholder="e.g. 20" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Year Discount (£)</Label>
                      <Input type="number" step="0.01" value={yearDiscountAmount} onChange={e => setYearDiscountAmount(e.target.value)} placeholder="e.g. 10" />
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

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={() => setStep(5)}>
                    Next: Staffing <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: Staffing */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Default Instructors</h3>
                  <p className="text-xs text-muted-foreground">Assign one or more instructors. Mark exactly one as Main; the rest are Assistants. Optionally set a pay-per-hour override per instructor.</p>
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
                            placeholder="default"
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
                  <h3 className="font-semibold text-foreground mb-1">Per-Session Overrides</h3>
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
                  <Button variant="outline" onClick={() => setStep(4)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving || sessions.length === 0}>
                    {saving ? "Saving..." : editing ? "Update Class" : "Create Class"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>All</Button>
        <Button variant={typeFilter === "children" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("children")}>Children</Button>
        <Button variant={typeFilter === "adult" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("adult")}>Adult</Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="All Venues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Venues</SelectItem>
            {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="w-px h-6 bg-border mx-1" />
        <Button variant={showPast ? "default" : "outline"} size="sm" onClick={() => setShowPast(!showPast)}>
          <Archive className="w-4 h-4 mr-1" /> Past Classes
        </Button>
        <span className="text-sm text-muted-foreground ml-2">{filteredClasses.length} class{filteredClasses.length !== 1 ? "es" : ""}</span>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading classes...</div>
      ) : filteredClasses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {showPast ? "No past classes found." : "No classes found. Click \"Add Class\" to create your first class."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClasses.map((c) => {
            const isExpanded = expandedClassId === c.id;
            const count = sessionCounts[c.id] || 0;
            const sessionsForClass = classSessions[c.id] || [];

            const toggleExpand = async () => {
              if (isExpanded) {
                setExpandedClassId(null);
                return;
              }
              setExpandedClassId(c.id);
              if (!classSessions[c.id]) {
                const { data } = await supabase
                  .from("class_sessions")
                  .select("*, staff(full_name)")
                  .eq("class_id", c.id)
                  .order("session_date", { ascending: true });
                if (data) setClassSessions(prev => ({ ...prev, [c.id]: data as any }));
              }
            };

            const isAdult = c.class_type === "adult";
            return (
              <Card key={c.id} className={`animate-fade-in overflow-hidden ${isAdult ? "border-accent/40 bg-accent/5" : "border-primary/30 bg-primary/5"}`}>
                {/* Main row */}
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0 cursor-pointer" onClick={toggleExpand}>
                      {c.workshops?.cover_image && (
                        <img src={getMediaUrl(c.workshops.cover_image)} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{c.name}</h3>
                          <Badge className={`capitalize ${isAdult ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                            {c.class_type === "children" ? "Children" : "Adult"}
                          </Badge>
                          {c.dance_style && <Badge variant="outline">{c.dance_style}</Badge>}
                          {(c as any).invite_only && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-500">Invite Only</Badge>
                          )}
                          {(c as any).status && (c as any).status !== "confirmed" && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-500 capitalize">{(c as any).status}</Badge>
                          )}
                          {(c as any).publicly_visible === false && (
                            <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>
                          )}
                          {(c as any).booking_enabled === false && !(c as any).invite_only && (
                            <Badge variant="outline" className="text-muted-foreground">Booking Off</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {(c.days_of_week?.length ? c.days_of_week : [c.day_of_week]).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}
                          {" • "}{c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                          {c.venues && ` • ${(c.venues as any).name}`}
                          {(() => {
                            const ids = classInstructors[c.id] || (c.instructor_id ? [c.instructor_id] : []);
                            const names = ids.map(id => staffList.find(s => s.id === id)?.full_name).filter(Boolean);
                            return names.length > 0 ? ` • ${names.join(", ")}` : c.staff ? ` • ${(c.staff as any).full_name}` : "";
                          })()}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(() => {
                            // Match class date range to school terms
                            const matchedTerms = c.term_start && c.term_end
                              ? schoolTerms.filter(t =>
                                  parseISO(t.start_date) >= parseISO(c.term_start!) && parseISO(t.end_date) <= parseISO(c.term_end!)
                                  || (parseISO(t.start_date) <= parseISO(c.term_end!) && parseISO(t.end_date) >= parseISO(c.term_start!))
                                )
                              : [];
                            return matchedTerms.length > 0 ? (
                              matchedTerms.map(t => (
                                <Badge key={t.id} variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                                  {t.name} ({t.academic_year})
                                </Badge>
                              ))
                            ) : null;
                          })()}
                          {c.term_start && c.term_end && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(c.term_start), "d MMM")} – {format(parseISO(c.term_end), "d MMM yyyy")}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {count} session{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 flex-wrap justify-end border-t lg:border-t-0 border-border/40 pt-3 lg:pt-0">
                      <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Cap: {c.capacity}</span>
                      {c.price_per_session && <span className="text-xs md:text-sm font-medium whitespace-nowrap">£{c.price_per_session}/session</span>}
                      <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={() => {
                        setSessionsClassId(c.id);
                        setSessionsClassName(c.name);
                        setSessionsInstructorIds(classInstructors[c.id] || (c.instructor_id ? [c.instructor_id] : []));
                      }}>
                        <ListChecks className="w-4 h-4" />
                        <span className="text-[9px] text-muted-foreground">Sessions</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="flex flex-col items-center gap-0 h-auto py-1 px-2" onClick={() => setStaffDialogClass({ id: c.id, name: c.name })}>
                        <User className="w-4 h-4" />
                        <span className="text-[9px] text-muted-foreground">Staff</span>
                      </Button>
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
                </CardContent>

                {/* Expanded sessions */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 px-6 py-3 space-y-1">
                    {sessionsForClass.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No sessions found.</p>
                    ) : (
                      sessionsForClass.map(session => {
                        const defaultInstructor = c.staff ? (c.staff as any).full_name : null;
                        const instructor = session.staff?.full_name || defaultInstructor;
                        return (
                          <div key={session.id} className="flex items-center gap-4 py-1.5 text-sm">
                            <span className="text-foreground font-medium w-48">
                              {format(parseISO(session.session_date), "EEE, d MMM yyyy")}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground w-32">
                              <Clock className="w-3 h-3" />
                              {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="w-3 h-3" />
                              {instructor || "Unassigned"}
                              {session.instructor_id && session.staff && defaultInstructor && session.staff.full_name !== defaultInstructor && (
                                <Badge variant="outline" className="ml-1 text-xs py-0">cover</Badge>
                              )}
                            </span>
                            <Badge variant="outline" className={`text-xs ml-auto ${
                              session.status === 'completed' ? 'text-green-400 border-green-500/20' :
                              session.status === 'cancelled' ? 'text-destructive border-destructive/20' :
                              'text-muted-foreground'
                            }`}>
                              {session.status}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick staff assignment — works for any class without re-running the wizard */}
      <AssignStaffDialog
        open={!!staffDialogClass}
        onOpenChange={(v) => { if (!v) setStaffDialogClass(null); }}
        classId={staffDialogClass?.id ?? null}
        className={staffDialogClass?.name ?? ""}
        staffList={staffList}
        onSaved={fetchData}
      />

      {/* Session Manager Dialog */}
      <SessionManager
        classId={sessionsClassId || ""}
        className={sessionsClassName}
        defaultInstructorIds={sessionsInstructorIds}
        staffList={staffList}
        open={!!sessionsClassId}
        onOpenChange={(v) => { if (!v) setSessionsClassId(null); }}
      />
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All sessions and bookings linked to this class will also be affected.</AlertDialogDescription>
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

export default AdminClasses;
