import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, LayoutGrid, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Chip,
  ChipRow,
  ChoiceSheet,
  ClassCalendar,
  ClassCard,
  ClassCardSkeleton,
  EmptyState,
  FilterPill,
  SectionHeading,
  SegmentedControl,
  VenuePicker,
  type CalendarGroup,
  type CalendarRowData,
  type ClassCardData,
  type VenueOption,
} from "@/components/booking";
import { ListRowsSkeleton } from "@/components/booking/PortalSkeletons";
import { Bone } from "@/components/booking/Skeletons";
import { QuietNotice } from "@/components/booking/QuietNotice";
import { timetableStripDays } from "@/lib/timetableGaps";
import { QuickBookDialog } from "@/components/portal/QuickBookDialog";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import { CampBookDialog } from "@/components/portal/CampBookDialog";
import { AdultPassesCard } from "@/components/portal/AdultPassesCard";
import WorkshopCover from "@/components/WorkshopCover";
import { audienceText, isChildAgeEligible } from "@/lib/classAudience";
import { classLinkPath } from "@/lib/classLinks";
import { availabilityFor, formatTimeRange } from "@/lib/bookingFormat";
import {
  campPriceLabel,
  classCardState,
  classDaysLabel,
  classPriceSummary,
  distanceLabel,
  haversineDistance,
  instructorFirstName,
  isClassFull,
  joinNames,
  shortDateRange,
  termDatesLine,
} from "@/lib/classPresentation";

const getWorkshopImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
  return data?.publicUrl || null;
};

interface VenueData {
  name: string;
  photo_outside: string | null;
  photo_indoor: string | null;
  photo_parking: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  directions: string | null;
  drop_off_info: string | null;
  has_parking: boolean | null;
  parking_details: string | null;
}

interface StaffData {
  full_name: string;
  profile_photo: string | null;
  description: string | null;
  dance_skills: string[];
}

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  class_type: "children" | "adult";
  dance_style: string | null;
  ability_level: string | null;
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number;
  price_per_session: number | null;
  price_per_term: number | null;
  price_per_month: number | null;
  price_per_year: number | null;
  term_discount_percent: number | null;
  monthly_discount_percent: number | null;
  day_of_week: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  term_start: string | null;
  term_end: string | null;
  allow_trial: boolean;
  /** Which plans this class offers (admin switches; default all on). */
  allow_monthly: boolean | null;
  allow_termly: boolean | null;
  allow_yearly: boolean | null;
  school_term_id: string | null;
  is_active: boolean;
  school_year_min: number | null;
  school_year_max: number | null;
  audience_label: string | null;
  invite_only: boolean;
  booking_enabled: boolean;
  status: string;
  publicly_visible: boolean;
  venue_id: string | null;
  venues: VenueData | null;
  staff: StaffData | null;
  workshops: { cover_image: string | null; cover_position: string | null; cover_zoom: number | null; cover_fit: string | null; name: string; description: string | null } | null;
}

interface ChildRow {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  expected_arrival_time: string | null;
  expected_departure_time: string | null;
}

type SessionRow = { id: string; session_date: string; start_time: string; end_time: string };

const CARD_GRID = "grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3";

/** How far ahead the calendar view looks. */
const CALENDAR_DAYS = 21;

type ViewMode = "list" | "calendar";

const ClassBrowser = () => {
  const { type } = useParams<{ type: string }>();
  // ?class=<id> — a link the studio sent a family, pointing at one class.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedClassId = searchParams.get("class");
  // ?camp=<id> — a shared link straight to one camp/event's booking dialog.
  const linkedCampId = searchParams.get("camp");
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const classType = type === "adult" ? "adult" : "children";
  const customerType = profile?.customer_type as string | null;
  const primaryIsAdult = customerType === "adult_dancer";
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [campsLoaded, setCampsLoaded] = useState(false);
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [selfStudent, setSelfStudent] = useState<any>(null);
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [profileNudge, setProfileNudge] = useState<any>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [classSessions, setClassSessions] = useState<Record<string, SessionRow[]>>({});
  const [hasExistingBookings, setHasExistingBookings] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState<"classes" | "camps" | "shows">("classes");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  // Style is a pure client-side filter over the sorted list.
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  // List of classes, or the same classes laid out by day. Lives in the URL
  // so the calendar can be linked to and survives going back.
  const view: ViewMode = searchParams.get("view") === "calendar" ? "calendar" : "list";
  const setView = (next: ViewMode) => {
    const params = new URLSearchParams(searchParams);
    if (next === "calendar") params.set("view", "calendar");
    else params.delete("view");
    setSearchParams(params, { replace: true });
  };
  // Calendar: the day on show (null = every day in the window).
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const [calendarAllDays, setCalendarAllDays] = useState(false);
  const [quickBookClassId, setQuickBookClassId] = useState<string | null>(null);
  const [bookCampId, setBookCampId] = useState<string | null>(null);
  const [schoolTerms, setSchoolTerms] = useState<{ name: string; term_type: string; start_date: string; end_date: string }[]>([]);
  // Waitlist: standing enrolment per class (via security-definer RPC) + the
  // classes this parent is already waitlisted for.
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [waitlistClassIds, setWaitlistClassIds] = useState<Set<string>>(new Set());
  const [waitlistBusy, setWaitlistBusy] = useState<string | null>(null);

  // Postcode search
  const [postcode, setPostcode] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  // The postcode field stays out of the way until "Near me" is tapped.
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch attendee profiles for logged-in users: children for children's
  // classes, plus the adult's own self profile (required to book adult classes).
  const fetchAttendees = () => {
    if (!user) return;
    // Full records so editing a profile mid-booking never blanks medical fields.
    supabase.from("students")
      .select("*")
      .eq("parent_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setChildren(data.filter((s: any) => !s.is_self));
        setSelfStudent(data.find((s: any) => s.is_self) ?? null);
      });
  };
  useEffect(fetchAttendees, [user]);

  // Term dates strip — parents see the term calendar while choosing classes.
  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("school_terms")
      .select("name, term_type, start_date, end_date")
      .in("term_type", ["autumn", "spring", "summer"])
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(3)
      .then(({ data }) => {
        if (!cancelled && data) setSchoolTerms(data as any);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-geocode parent's home postcode for proximity sorting
  useEffect(() => {
    const pc = ((profile as any)?.postcode as string | null)?.trim();
    if (!pc) return;
    fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 200 && json.result) {
          setHomeCoords({ lat: json.result.latitude, lon: json.result.longitude });
        }
      })
      .catch(() => {});
  }, [(profile as any)?.postcode]);

  // Check if user has any existing bookings (for free trial eligibility)
  useEffect(() => {
    if (!user) { setHasExistingBookings(null); return; }
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("parent_id", user.id)
      .eq("status", "confirmed")
      .then(({ count }) => {
        setHasExistingBookings((count ?? 0) > 0);
      });
  }, [user]);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      const { data: rawData } = await supabase
        .from("classes")
        .select(`*,
          venues(name, photo_outside, photo_indoor, photo_parking, address_line1, address_line2, city, postcode, latitude, longitude, directions, drop_off_info, has_parking, parking_details),
          workshops(cover_image, cover_position, cover_zoom, cover_fit, name, description)`)
        .eq("is_active", true)
        .eq("publicly_visible", true)
        .eq("status", "confirmed")
        .eq("class_type", classType as any)
        .order("sort_order")
        .order("day_of_week")
        .order("start_time");
      // Instructor details come from the public-safe staff view (first names
      // only — the staff table itself is not publicly readable).
      let data = rawData as any[] | null;
      if (data) {
        const instructorIds = [...new Set(data.map((c: any) => c.instructor_id).filter(Boolean))];
        let staffById = new Map<string, any>();
        if (instructorIds.length > 0) {
          const { data: staffRows } = await (supabase.from("staff_public" as any) as any)
            .select("id, first_name, profile_photo, description, dance_skills")
            .in("id", instructorIds);
          staffById = new Map(((staffRows as any[]) ?? []).map((s) => [
            s.id,
            { full_name: s.first_name, profile_photo: s.profile_photo, description: s.description, dance_skills: s.dance_skills },
          ]));
        }
        data = data.map((c: any) => ({
          ...c,
          staff: c.instructor_id ? staffById.get(c.instructor_id) ?? null : null,
        }));
      }
      if (data) {
        // Fetch all scheduled sessions for the listed classes in one query,
        // splitting upcoming from past client-side.
        const counts: Record<string, number> = {};
        const totalCounts: Record<string, number> = {};
        const sessions: Record<string, SessionRow[]> = {};
        const today = new Date().toISOString().split("T")[0];
        const ids = data.map((cls: any) => cls.id);
        if (ids.length > 0) {
          const { data: sessionData } = await supabase
            .from("class_sessions")
            .select("id, class_id, session_date, start_time, end_time")
            .in("class_id", ids)
            .eq("status", "scheduled")
            .order("session_date");
          for (const s of sessionData || []) {
            totalCounts[s.class_id] = (totalCounts[s.class_id] || 0) + 1;
            if (s.session_date >= today) {
              if (!sessions[s.class_id]) sessions[s.class_id] = [];
              sessions[s.class_id].push(s);
              counts[s.class_id] = (counts[s.class_id] || 0) + 1;
            }
          }
        }
        // Show classes with upcoming sessions, plus new classes whose session
        // dates haven't been generated yet (no sessions at all and no term end
        // in the past). Hide only genuinely finished classes — ones whose
        // sessions have all elapsed or whose term has ended.
        const activeClasses = data.filter((cls: any) => {
          if ((counts[cls.id] || 0) > 0) return true;
          const hasAnySessions = (totalCounts[cls.id] || 0) > 0;
          const termEnded = cls.term_end && cls.term_end < today;
          return !hasAnySessions && !termEnded;
        });
        setClasses(activeClasses as any);
        setClassSessions(sessions);
        setSessionCounts(counts);

        // Standing enrolment per class so we can show "class full" + waitlist.
        const activeIds = activeClasses.map((cls: any) => cls.id);
        if (activeIds.length > 0) {
          const { data: enrolData } = await (supabase.rpc as any)("get_class_enrollment", { _class_ids: activeIds });
          const enrol: Record<string, number> = {};
          for (const row of enrolData ?? []) enrol[row.class_id] = Number(row.confirmed_count);
          setEnrollmentCounts(enrol);
        }
      }
      setLoading(false);
    };
    fetchClasses();
    setVenueFilter("all");
    setStyleFilter("all");
  }, [classType]);

  // This parent's waitlist entries (to toggle Join/Leave on full classes).
  useEffect(() => {
    if (!user) { setWaitlistClassIds(new Set()); return; }
    (supabase.from("class_waitlist" as any) as any)
      .select("class_id")
      .eq("parent_id", user.id)
      .then(({ data }: any) => {
        if (data) setWaitlistClassIds(new Set<string>(data.map((w: any) => w.class_id as string)));
      });
  }, [user]);

  const toggleWaitlist = async (classId: string, className: string) => {
    if (!user) { navigate("/auth"); return; }
    setWaitlistBusy(classId);
    const table = supabase.from("class_waitlist" as any) as any;
    if (waitlistClassIds.has(classId)) {
      const { error } = await table.delete().eq("class_id", classId).eq("parent_id", user.id);
      if (error) {
        toast.error("Couldn't leave the waitlist — please try again.");
      } else {
        setWaitlistClassIds(prev => { const next = new Set(prev); next.delete(classId); return next; });
        toast.success("Removed from waitlist", { description: className });
      }
    } else {
      const { error } = await table.insert({ class_id: classId, parent_id: user.id });
      if (error) {
        toast.error("Couldn't join the waitlist — please try again.");
      } else {
        setWaitlistClassIds(prev => new Set(prev).add(classId));
        toast.success("You're on the waitlist!", {
          description: `We'll email you as soon as a space opens up in ${className}.`,
        });
      }
    }
    setWaitlistBusy(null);
  };

  // Fetch camps
  useEffect(() => {
    setCampsLoaded(false);
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("camps")
      .select("*, venues(name, address_line1, city, postcode, latitude, longitude), workshops(cover_image, cover_position, cover_zoom, cover_fit, name)")
      .eq("is_active", true)
      .eq("class_type", classType as any)
      .gte("end_date", today)
      .order("start_date")
      .then(({ data }) => { if (data) setCamps(data); setCampsLoaded(true); });
  }, [classType]);

  // Fetch shows
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("shows")
      .select("*, venues(name, address_line1, city, postcode)")
      .eq("is_active", true)
      .eq("class_type", classType as any)
      .gte("show_date", today)
      .order("show_date")
      .then(({ data }) => { if (data) setShows(data as any); });
  }, [classType]);

  const handlePostcodeSearch = async () => {
    const cleaned = postcode.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    setSearchLoading(true);
    setSearchError("");
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
      const json = await res.json();
      if (json.status === 200 && json.result) {
        setSearchCoords({ lat: json.result.latitude, lon: json.result.longitude });
      } else {
        setSearchError("Postcode not found. Please try again.");
        setSearchCoords(null);
      }
    } catch {
      setSearchError("Could not search postcode. Please try again.");
      setSearchCoords(null);
    }
    setSearchLoading(false);
  };

  const clearSearch = () => {
    setPostcode("");
    setSearchCoords(null);
    setSearchError("");
  };

  // Once a postcode has resolved the field folds away; "Sorted by distance
  // from …" says what happened.
  useEffect(() => {
    if (searchCoords) setSearchOpen(false);
  }, [searchCoords]);

  const submitPostcode = (e: FormEvent) => {
    e.preventDefault();
    void handlePostcodeSearch();
  };

  const closeSearch = () => {
    clearSearch();
    setSearchOpen(false);
  };

  // Helper: calculate age from DOB
  const getAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  // Which children match a class's age range? (A year's grace before the
  // minimum age — kids whose birthday is coming up can book early.)
  const getMatchingChildren = (c: {
    age_min: number | null;
    age_max: number | null;
    class_type?: "children" | "adult" | null;
  }) => {
    if (!children.length) return [];
    return children.filter(child =>
      isChildAgeEligible(
        child.date_of_birth, c.age_min, c.age_max, getAge(child.date_of_birth), c.class_type,
      ),
    );
  };

  // A shared class link (/classes/…?class=<id>) opens that class: clear any
  // filter that would hide it, highlight it and scroll to it. The card can
  // render a beat after the classes arrive, so we look for it a few times
  // rather than once, and only drop the parameter once we've actually got
  // there — otherwise a slow render loses the link's intent entirely.
  const handledLinkRef = useRef<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!linkedClassId || loading) return;
    if (handledLinkRef.current === linkedClassId) return;
    if (!classes.some(c => c.id === linkedClassId)) return;

    handledLinkRef.current = linkedClassId;
    setActiveSection("classes");
    setVenueFilter("all");
    setStyleFilter("all");
    setHighlightId(linkedClassId);
    // The card lives in the list view; the calendar shows sessions, not cards.
    if (view === "calendar") {
      const params = new URLSearchParams(searchParams);
      params.delete("view");
      setSearchParams(params, { replace: true });
    }

    let attempts = 0;
    let timer = 0;
    const findAndScroll = () => {
      const el = document.getElementById(`class-${linkedClassId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Read the live URL: the view switch above may have replaced it.
        const next = new URLSearchParams(window.location.search);
        next.delete("class");
        setSearchParams(next, { replace: true });
        return;
      }
      if (attempts++ < 20) timer = window.setTimeout(findAndScroll, 120);
    };
    timer = window.setTimeout(findAndScroll, 120);
    const fade = window.setTimeout(() => setHighlightId(null), 4000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedClassId, loading, classes]);

  // A shared camp link opens the Events section with that camp's booking
  // dialog ready. Camps load in their own effect, so wait for them.
  const handledCampRef = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedCampId || handledCampRef.current === linkedCampId) return;
    const found = camps.some((cp: any) => cp.id === linkedCampId);
    if (!found && !campsLoaded) return; // still loading — keep the link alive
    handledCampRef.current = linkedCampId;
    const next = new URLSearchParams(searchParams);
    next.delete("camp");
    setSearchParams(next, { replace: true });
    if (!found) {
      // The fetch only returns active, not-yet-ended events, so a shared
      // link can outlive the event it points at.
      toast.info("That event has finished or is no longer open for booking.");
      return;
    }
    setActiveSection("camps");
    setBookCampId(linkedCampId);
    window.setTimeout(() => {
      document.getElementById("section-camps")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedCampId, camps, campsLoaded]);

  // Effective coords: manual search overrides home coords
  const effectiveCoords = searchCoords || homeCoords;

  // Venues for the picker come from the loaded classes, so only venues
  // actually running classes of this type appear — with the town, how many
  // classes run there and, once the parent has said where they are, how far.
  const venueRows = useMemo<VenueOption[]>(() => {
    const byId = new Map<string, VenueOption & { dist: number }>();
    for (const c of classes) {
      const v = c.venues as VenueData | null;
      if (!c.venue_id || !v?.name) continue;
      const existing = byId.get(c.venue_id);
      if (existing) { existing.count += 1; continue; }
      const dist = effectiveCoords && v.latitude && v.longitude
        ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, v.latitude, v.longitude)
        : null;
      byId.set(c.venue_id, {
        id: c.venue_id,
        name: v.name,
        area: v.city || null,
        count: 1,
        distanceLabel: dist != null ? distanceLabel(dist) : null,
        dist: dist ?? 9999,
      });
    }
    return [...byId.values()]
      .sort((a, b) => (effectiveCoords ? a.dist - b.dist || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)))
      .map(({ dist: _dist, ...v }) => v);
  }, [classes, effectiveCoords]);

  // Styles likewise come from what is actually on offer.
  const styleOptions = useMemo(
    () => [...new Set(classes.map((c) => c.dance_style).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)),
    [classes],
  );

  // Calendar window: three weeks from the next scheduled session across every
  // class of this audience, so during a holiday the strip starts when classes
  // come back rather than on an empty today. (Sessions are upcoming-only and
  // date-ordered, so the first of each class is its next.)
  const calendarWindow = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let first: string | null = null;
    for (const c of classes) {
      const s = classSessions[c.id]?.[0];
      if (s && (!first || s.session_date < first)) first = s.session_date;
    }
    if (!first) return null;
    const start = first > today ? first : today;
    const end = format(addDays(parseISO(start), CALENDAR_DAYS - 1), "yyyy-MM-dd");
    const backOn = first > format(addDays(new Date(), CALENDAR_DAYS), "yyyy-MM-dd") ? first : null;
    return { start, end, backOn };
  }, [classes, classSessions]);

  // Sort: age-matched classes first, then by distance
  const sortedClasses = useMemo(() => {
    const filtered = venueFilter === "all" ? classes : classes.filter(c => c.venue_id === venueFilter);
    const scored = filtered.map(c => {
      const matched = getMatchingChildren(c);
      const ageScore = matched.length > 0 ? 0 : 1;
      let dist = 9999;
      if (effectiveCoords) {
        const v = c.venues as VenueData | null;
        if (v?.latitude && v?.longitude) {
          dist = haversineDistance(effectiveCoords.lat, effectiveCoords.lon, v.latitude, v.longitude);
        }
      }
      return { cls: c, ageScore, dist, matched };
    });
    scored.sort((a, b) => a.ageScore - b.ageScore || a.dist - b.dist);
    return scored;
  }, [classes, effectiveCoords, children, venueFilter]);

  const visibleClasses = useMemo(
    () => (styleFilter === "all" ? sortedClasses : sortedClasses.filter((x) => x.cls.dance_style === styleFilter)),
    [sortedClasses, styleFilter],
  );

  const getDistance = (c: ClassItem) => {
    if (!effectiveCoords) return null;
    const v = c.venues as VenueData | null;
    if (!v?.latitude || !v?.longitude) return null;
    return haversineDistance(effectiveCoords.lat, effectiveCoords.lon, v.latitude, v.longitude);
  };

  const isAdult = classType === "adult";
  const otherType = isAdult ? "children" : "adult";

  // The section switch only earns its place when there is something besides
  // classes to switch to; without it, classes are simply the page.
  const hasSectionSwitch = camps.length > 0 || shows.length > 0;
  const section = hasSectionSwitch ? activeSection : "classes";
  const filtersActive = venueFilter !== "all" || styleFilter !== "all";
  const currentTerm = schoolTerms[0];
  const sortedFrom = searchCoords && !searchError
    ? postcode.toUpperCase()
    : !searchCoords && homeCoords && !searchError
      ? "your home address"
      : null;

  const goToSection = (key: "classes" | "camps" | "shows") => {
    setActiveSection(key);
    // The section mounts on the next render; give it a beat before scrolling.
    window.setTimeout(() => {
      document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const cardDataFor = (c: ClassItem, matched: ChildRow[]): ClassCardData => {
    const venue = c.venues as VenueData | null;
    const distance = getDistance(c);
    const remaining = sessionCounts[c.id] || 0;
    const { priceLabel, priceHint } = classPriceSummary(c, remaining);
    const full = isClassFull(c.capacity, enrollmentCounts[c.id]);
    const cover = getWorkshopImageUrl(c.workshops?.cover_image) || venue?.photo_indoor || venue?.photo_outside || null;
    return {
      id: c.id,
      name: c.name,
      style: c.dance_style,
      audience: audienceText(c) || null,
      dayLabel: classDaysLabel(c.days_of_week, c.day_of_week),
      timeLabel: formatTimeRange(c.start_time, c.end_time),
      venue: venue ? (distance != null ? `${venue.name} · ${distanceLabel(distance)}` : venue.name) : null,
      instructor: instructorFirstName(c.staff?.full_name),
      priceLabel,
      priceHint,
      availability: availabilityFor(c.capacity, enrollmentCounts[c.id]),
      coverUrl: cover,
      coverPosition: c.workshops?.cover_position ?? null,
      // Child matches are a children's-page thing: adults book themselves.
      matchedNames: isAdult ? [] : matched.map((ch) => ch.preferred_name || ch.first_name),
      state: classCardState(c, full),
      onWaitlist: waitlistClassIds.has(c.id),
    };
  };

  // The one primary action on a class — the same whether it sits on a card
  // or a calendar row: book, or join the waitlist when it is full.
  const handlePrimary = (c: ClassItem, state: ClassCardData["state"]) => {
    if (state === "full") { toggleWaitlist(c.id, c.name); return; }
    if (state !== "bookable") return;
    if (!user) { navigate("/auth"); return; }
    setQuickBookClassId(c.id);
  };

  // The same classes laid out by day: every session of the visible classes
  // inside the window, grouped by date and ordered by start time.
  const buildCalendarGroups = (): CalendarGroup[] => {
    if (!calendarWindow) return [];
    const byDate = new Map<string, CalendarRowData[]>();
    for (const { cls: c, matched } of visibleClasses) {
      const data = cardDataFor(c, matched);
      const price = data.priceLabel
        ? `${data.priceLabel}${data.priceHint ? (data.priceHint.startsWith("/") ? data.priceHint : ` ${data.priceHint}`) : ""}`
        : null;
      for (const s of classSessions[c.id] ?? []) {
        if (s.session_date < calendarWindow.start) continue;
        if (s.session_date > calendarWindow.end) break;
        const row: CalendarRowData = {
          key: s.id,
          classId: c.id,
          startTime: s.start_time,
          endTime: s.end_time,
          title: c.name,
          // With one venue chosen its name would repeat on every row.
          meta: [data.style, venueFilter === "all" ? data.venue : null, data.instructor ? `with ${data.instructor}` : null].filter(Boolean).join(" · ") || null,
          sub: [data.audience, price, data.matchedNames.length ? `Suits ${joinNames(data.matchedNames)}` : null].filter(Boolean).join(" · ") || null,
          availability: data.availability,
          state: data.state,
          onWaitlist: data.onWaitlist,
          busy: waitlistBusy === c.id,
          highlighted: highlightId === c.id,
        };
        if (!byDate.has(s.session_date)) byDate.set(s.session_date, []);
        byDate.get(s.session_date)!.push(row);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)),
      }));
  };
  const calendarGroups = view === "calendar" && !loading ? buildCalendarGroups() : [];
  const calendarDates = calendarGroups.map((g) => g.date);
  const stripDays = timetableStripDays(
    calendarGroups.flatMap((g) => g.rows.map(() => g.date)),
    calendarWindow?.start,
    calendarWindow?.end,
  );
  // The day on show: the picked one while it still has sessions, otherwise
  // the first that does. Null lists every day in the window.
  const shownDay = calendarAllDays
    ? null
    : calendarDay && calendarDates.includes(calendarDay) ? calendarDay : calendarDates[0] ?? null;
  const visibleGroups = shownDay ? calendarGroups.filter((g) => g.date === shownDay) : calendarGroups;

  // "Near me" lives inside the venue sheet: choosing by distance is choosing
  // a venue. Same postcode search as before, just where it belongs.
  const nearMeBlock = (
    <div className="mb-4">
      {sortedFrom ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
          <span>
            Sorted by distance from <span className="font-medium text-foreground">{sortedFrom}</span>
          </span>
          {searchCoords && (
            <button type="button" onClick={closeSearch} className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline">
              Clear
            </button>
          )}
        </div>
      ) : searchOpen ? (
        <form onSubmit={submitPostcode} className="flex items-center gap-2">
          <Input
            aria-label="Your postcode"
            placeholder="Your postcode"
            autoFocus
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="h-12 rounded-xl text-base"
          />
          <Button type="submit" variant="ink" className="h-12 shrink-0 rounded-xl px-5" disabled={searchLoading || !postcode.trim()}>
            {searchLoading ? "Searching…" : "Search"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="pressable flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-foreground">Near me</span>
            <span className="block text-[13px] text-muted-foreground">Enter your postcode to sort venues by distance</span>
          </span>
        </button>
      )}
      {searchError && <p className="mt-2 text-[13px] text-destructive">{searchError}</p>}
    </div>
  );

  const audienceSwitch = (
    <div className="inline-flex gap-2" role="group" aria-label="Who the classes are for">
      {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((t) => (
        <Chip
          key={t}
          selected={t === classType}
          onClick={() => { if (t !== classType) navigate(`/classes/${t}`); }}
        >
          {t === "adult" ? "Adults" : "Children"}
        </Chip>
      ))}
    </div>
  );

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="container py-8 sm:py-12">
        <SectionHeading
          as="h1"
          size="page"
          eyebrow="Essex · term-time classes"
          title={isAdult ? "Adult classes" : "Children's classes"}
          subtitle={isAdult
            ? "Weekly pay-as-you-go classes for all levels — step out of your comfort zone and into the spotlight."
            : "Fun, high-energy weekly classes across Essex — pick a class to see dates, prices and who's teaching."}
          aside={<div className="hidden sm:block">{audienceSwitch}</div>}
        />
        <div className="mt-5 sm:hidden">{audienceSwitch}</div>

        {/* Where, what, and how to look at it — one calm row below the heading */}
        {!loading && classes.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {venueRows.length >= 2 && (
                <VenuePicker
                  className="sm:w-auto sm:min-w-[300px] sm:max-w-sm"
                  venues={venueRows}
                  value={venueFilter}
                  onChange={setVenueFilter}
                  totalCount={classes.length}
                  above={nearMeBlock}
                />
              )}
              {styleOptions.length >= 2 && (
                <FilterPill
                  label="Style"
                  value={styleFilter === "all" ? null : styleFilter}
                  onClick={() => setStyleSheetOpen(true)}
                />
              )}
              <SegmentedControl<ViewMode>
                className="ml-auto"
                ariaLabel="How to show the classes"
                value={view}
                onChange={setView}
                segments={[
                  { id: "list", label: "List", icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
                  { id: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {sortedFrom && (
                  <span>
                    Sorted by distance from <span className="font-medium text-foreground">{sortedFrom}</span>
                  </span>
                )}
                {searchCoords && (
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="rounded-md font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                  >
                    Clear
                  </button>
                )}
              </div>
              {currentTerm && (
                <p>
                  {termDatesLine(currentTerm)}
                  <span aria-hidden> · </span>
                  <Link to="/term-dates" className="font-medium text-foreground underline-offset-4 hover:underline">Term dates</Link>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Adult multi-class passes + birthday class */}
        {isAdult && (
          <div className="mt-8">
            <AdultPassesCard
              sessionOptions={classes.flatMap((c) =>
                (classSessions[c.id] || []).map((s) => ({
                  id: s.id,
                  classId: c.id,
                  className: c.name,
                  session_date: s.session_date,
                  start_time: s.start_time,
                  end_time: s.end_time,
                  venueName: (c.venues as VenueData | null)?.name || null,
                }))
              )}
              selfStudent={selfStudent}
              onRedeemed={() => setHasExistingBookings(true)}
            />
          </div>
        )}

        {/* Classes / events / shows */}
        {hasSectionSwitch && !loading && (
          <ChipRow className="mt-10">
            <Chip selected={section === "classes"} onClick={() => goToSection("classes")} trailing={visibleClasses.length}>
              Classes
            </Chip>
            {camps.length > 0 && (
              <Chip selected={section === "camps"} onClick={() => goToSection("camps")} trailing={camps.length}>
                {isAdult ? "Workshops & events" : "Holiday & weekend events"}
              </Chip>
            )}
            {shows.length > 0 && (
              <Chip selected={section === "shows"} onClick={() => goToSection("shows")} trailing={shows.length}>
                Shows
              </Chip>
            )}
          </ChipRow>
        )}

        {/* CLASSES SECTION */}
        {section === "classes" && (
          <section id="section-classes" className="mt-8 scroll-mt-40 md:scroll-mt-52" aria-label="Classes">
            {loading ? (
              view === "calendar" ? (
                <div className="space-y-6">
                  <div className="flex gap-2 overflow-hidden">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Bone key={i} className="h-[68px] w-[54px] shrink-0 rounded-2xl" />
                    ))}
                  </div>
                  <ListRowsSkeleton rows={6} />
                </div>
              ) : (
                <div className={CARD_GRID}>
                  {Array.from({ length: 6 }).map((_, i) => <ClassCardSkeleton key={i} />)}
                </div>
              )
            ) : view === "calendar" ? (
              <>
                {calendarWindow?.backOn && (
                  <QuietNotice
                    className="mb-6"
                    title={`We're on a break — classes are back ${format(parseISO(calendarWindow.backOn), "EEEE d MMMM")}.`}
                  >
                    Here's the start of the new term so you can plan (and book) ahead.
                  </QuietNotice>
                )}
                <ClassCalendar
                  days={stripDays}
                  day={shownDay}
                  onChangeDay={(d) => { setCalendarDay(d); setCalendarAllDays(false); }}
                  onAllDays={() => setCalendarAllDays(true)}
                  groups={visibleGroups}
                  horizonLabel="next 3 weeks"
                  onOpen={(id) => navigate(classLinkPath(id))}
                  onPrimary={(row) => {
                    const c = classes.find((x) => x.id === row.classId);
                    if (c) handlePrimary(c, row.state);
                  }}
                  empty={
                    filtersActive ? (
                      <EmptyState
                        title="Nothing at this venue in the next three weeks"
                        body="Try another venue or style, or show everything."
                        action={
                          <Button variant="soft" className="h-11 rounded-full px-5" onClick={() => { setVenueFilter("all"); setStyleFilter("all"); }}>
                            Show all classes
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        title="No upcoming sessions"
                        body="Check back soon — new classes are added each term."
                      />
                    )
                  }
                />
              </>
            ) : visibleClasses.length === 0 ? (
              filtersActive ? (
                <EmptyState
                  title="No classes at this venue yet"
                  body="Try another venue or style, or show everything."
                  action={
                    <Button variant="soft" className="h-11 rounded-full px-5" onClick={() => { setVenueFilter("all"); setStyleFilter("all"); }}>
                      Show all classes
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No classes available right now"
                  body="Check back soon — new classes are added each term."
                  action={
                    <Button variant="soft" className="h-11 rounded-full px-5" asChild>
                      <Link to={`/classes/${otherType}`}>{isAdult ? "Children's classes" : "Adult classes"}</Link>
                    </Button>
                  }
                />
              )
            ) : (
              <div className={CARD_GRID}>
                {visibleClasses.map(({ cls: c, matched }) => {
                  const data = cardDataFor(c, matched);
                  return (
                    <ClassCard
                      key={c.id}
                      data={data}
                      highlighted={highlightId === c.id}
                      busy={waitlistBusy === c.id}
                      onOpen={() => navigate(classLinkPath(c.id))}
                      onPrimary={() => handlePrimary(c, data.state)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* CAMPS / EVENTS SECTION — both audiences (the fetch already
            filters camps to this page's class_type) */}
        {section === "camps" && (
          <section id="section-camps" className="mt-8 scroll-mt-40 md:scroll-mt-52" aria-label="Events">
            {camps.length === 0 ? (
              <EmptyState title="No upcoming events" body="Check back soon — holiday and weekend events are added through the year." />
            ) : (
              <div className={CARD_GRID}>
                {[...camps].sort((a: any, b: any) => {
                  if (!isAdult) {
                    const aMatch = getMatchingChildren(a).length > 0 ? 0 : 1;
                    const bMatch = getMatchingChildren(b).length > 0 ? 0 : 1;
                    if (aMatch !== bMatch) return aMatch - bMatch;
                  }
                  if (!effectiveCoords) return 0;
                  const aDist = a.venues?.latitude && a.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, a.venues.latitude, a.venues.longitude) : 9999;
                  const bDist = b.venues?.latitude && b.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, b.venues.latitude, b.venues.longitude) : 9999;
                  return aDist - bDist;
                }).map((camp: any) => {
                  const workshopImage = getWorkshopImageUrl(camp.workshops?.cover_image);
                  const venue = camp.venues;
                  // Child-match tags are a children's-page thing: adults
                  // book themselves, so "Suits Tilly" would mislead.
                  const campMatchedChildren = isAdult ? [] : getMatchingChildren(camp);
                  const campChildNames = campMatchedChildren.map((ch: any) => ch.preferred_name || ch.first_name);
                  const ages = camp.age_min != null && camp.age_max != null ? `Ages ${camp.age_min}–${camp.age_max}` : null;
                  const meta = [
                    shortDateRange(camp.start_date, camp.end_date),
                    formatTimeRange(camp.start_time, camp.end_time),
                    venue?.name,
                    ages,
                  ].filter(Boolean).join(" · ");
                  const price = campPriceLabel(camp);
                  return (
                    <article key={camp.id} className="surface flex flex-col overflow-hidden">
                      {workshopImage && (
                        <div className="aspect-[2/1] w-full overflow-hidden bg-muted">
                          <WorkshopCover
                            src={workshopImage}
                            alt=""
                            cover_position={camp.workshops?.cover_position}
                            cover_zoom={camp.workshops?.cover_zoom}
                            cover_fit={camp.workshops?.cover_fit}
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-medium text-muted-foreground">Event</p>
                          {campChildNames.length > 0 && (
                            <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                              Suits {joinNames(campChildNames)}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{camp.name}</h3>
                        {camp.description && (
                          <p className="mt-1.5 line-clamp-1 text-[15px] text-muted-foreground">{camp.description}</p>
                        )}
                        {meta && <p className="mt-2 text-[15px] text-foreground/90">{meta}</p>}
                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/70 pt-4">
                          <p className="text-[17px] font-semibold tabular-nums text-foreground">
                            {price ? (
                              <>
                                {price.amount}
                                <span className="ml-1 text-[13px] font-normal text-muted-foreground">{price.hint}</span>
                              </>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (!user) { navigate("/auth"); return; }
                              setBookCampId(camp.id);
                            }}
                            className="pressable inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SHOWS SECTION */}
        {section === "shows" && (
          <section id="section-shows" className="mt-8 scroll-mt-40 md:scroll-mt-52" aria-label="Shows">
            {shows.length === 0 ? (
              <EmptyState title="No upcoming shows" body="Check back soon." />
            ) : (
              <div className={CARD_GRID}>
                {shows.map((show: any) => {
                  const venue = show.venues;
                  const meta = [
                    show.show_date ? format(parseISO(show.show_date), "EEEE d MMMM yyyy") : null,
                    show.show_time ? `Doors ${show.show_time.slice(0, 5)}${show.duration_minutes ? ` · ${show.duration_minutes} mins` : ""}` : null,
                    venue ? `${venue.name}, ${venue.city}` : null,
                  ].filter(Boolean);
                  return (
                    <article key={show.id} className="surface flex flex-col overflow-hidden">
                      {show.cover_image && (
                        <div className="aspect-[2/1] w-full overflow-hidden bg-muted">
                          <img src={show.cover_image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <p className="text-[13px] font-medium text-muted-foreground">
                          {["Show", show.dance_style].filter(Boolean).join(" · ")}
                        </p>
                        <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{show.name}</h3>
                        {show.description && (
                          <p className="mt-1.5 line-clamp-2 text-[15px] text-muted-foreground">{show.description}</p>
                        )}
                        <div className="mt-2 space-y-0.5 text-[15px] text-foreground/90">
                          {meta.map((line) => <p key={line}>{line}</p>)}
                          {show.capacity ? (
                            <p className="text-muted-foreground">{show.capacity - (show.tickets_sold || 0)} tickets remaining</p>
                          ) : null}
                        </div>
                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/70 pt-4">
                          <p className="text-[17px] font-semibold tabular-nums text-foreground">
                            {show.ticket_price ? (
                              <>
                                £{show.ticket_price}
                                <span className="ml-1 text-[13px] font-normal text-muted-foreground">/ticket</span>
                              </>
                            ) : (
                              <span className="text-success">FREE</span>
                            )}
                          </p>
                          <Button
                            variant="soft"
                            className="h-11 rounded-full px-5 text-[15px] font-semibold"
                            onClick={() => { if (!user) navigate("/auth"); }}
                          >
                            Get Tickets
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Style picker — counts follow the chosen venue */}
      <ChoiceSheet
        open={styleSheetOpen}
        onOpenChange={setStyleSheetOpen}
        title="Style"
        description="Narrow the classes to one style."
        value={styleFilter}
        onChange={setStyleFilter}
        options={[
          { id: "all", label: "All styles", meta: `${sortedClasses.length} ${sortedClasses.length === 1 ? "class" : "classes"}` },
          ...styleOptions.map((s) => {
            const n = sortedClasses.filter((x) => x.cls.dance_style === s).length;
            return { id: s, label: s, meta: `${n} ${n === 1 ? "class" : "classes"}`, disabled: n === 0 };
          }),
        ]}
      />

      <QuickBookDialog
        open={!!quickBookClassId}
        onOpenChange={(o) => { if (!o) setQuickBookClassId(null); }}
        classData={quickBookClassId ? (classes.find(c => c.id === quickBookClassId) as any) : null}
        sessions={quickBookClassId ? (classSessions[quickBookClassId] || []) : []}
        children={children}
        hasExistingBookings={hasExistingBookings}
        isAdult={isAdult}
        selfStudent={selfStudent}
        onChildrenChanged={fetchAttendees}
      />

      {/* Adult self attendee profile — required before booking for yourself */}
      <ChildFormDialog
        open={selfDialogOpen}
        onOpenChange={setSelfDialogOpen}
        onSaved={fetchAttendees}
        editing={selfStudent}
        selfMode
      />

      {/* Complete a child's profile mid-booking */}
      <ChildFormDialog
        open={!!profileNudge}
        onOpenChange={(o) => { if (!o) setProfileNudge(null); }}
        onSaved={fetchAttendees}
        editing={profileNudge}
      />

      {/* Add a new child mid-booking */}
      <ChildFormDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onSaved={fetchAttendees}
        editing={null}
      />

      {/* Book a holiday workshop (camp) — priced per drop-in day */}
      {(() => {
        const bookingCamp = bookCampId ? (camps.find((cp: any) => cp.id === bookCampId) as any) : null;
        const campIsAdult = bookingCamp?.class_type === "adult";
        return (
          <CampBookDialog
            open={!!bookCampId}
            onOpenChange={(o) => { if (!o) setBookCampId(null); }}
            camp={bookingCamp}
            // Adult events are booked for the account holder's own attendee
            // profile; children's camps offer the family's kids.
            children={campIsAdult ? (selfStudent ? [selfStudent] : []) : children}
            onNeedChild={(child) => {
              if (campIsAdult) { setSelfDialogOpen(true); return; }
              if (child) setProfileNudge(child);
              else setAddChildOpen(true);
            }}
          />
        );
      })()}
    </div>
  );
};

export default ClassBrowser;
