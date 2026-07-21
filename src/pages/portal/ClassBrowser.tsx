import { useEffect, useState, useMemo, type ReactNode } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, type PricingPlan } from "@/contexts/CartContext";

const getWorkshopImageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
  return data?.publicUrl || null;
};

const getStaffPhotoUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
  return data?.publicUrl || null;
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, Clock, MapPin, Users, Sparkles, Heart, Camera, Car, Navigation,
  ChevronDown, ChevronUp, Search, X, Info, ShoppingCart, Tag, Ticket, Star, Music, UserPlus
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { audienceText, isClassBookable } from "@/lib/classAudience";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QuickBookDialog } from "@/components/portal/QuickBookDialog";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import { FadeRise, AmbientGlow } from "@/components/motion";

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
  class_type: string;
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
  school_term_id: string | null;
  is_active: boolean;
  school_year_min: number | null;
  school_year_max: number | null;
  audience_label: string | null;
  invite_only: boolean;
  booking_enabled: boolean;
  status: string;
  publicly_visible: boolean;
  venues: VenueData | null;
  staff: StaffData | null;
  workshops: { cover_image: string | null; name: string; description: string | null } | null;
}

// Ability levels ordered from lowest to highest. "All Levels" is treated as
// the lowest minimum so it always shows regardless of the selected ability.
const ABILITY_LEVELS = ["All Levels", "Beginner", "Improver", "Intermediate", "Advanced"] as const;
const abilityRank = (level: string | null | undefined) => {
  if (!level) return 0;
  const idx = ABILITY_LEVELS.indexOf(level as (typeof ABILITY_LEVELS)[number]);
  return idx === -1 ? 0 : idx;
};

// Normalise a class's gender value to one of the three known options.
const normaliseGender = (gender: string | null | undefined): "boys" | "girls" | "mixed" => {
  const g = (gender || "mixed").toLowerCase();
  if (g === "boys") return "boys";
  if (g === "girls") return "girls";
  return "mixed";
};

const formatDays = (days: string[]) => {
  if (!days || days.length === 0) return null;
  return days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
};

const formatDateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return null;
  try {
    return `${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM yyyy")}`;
  } catch { return null; }
};

// Haversine distance in miles
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Small icon tile used on schedule rows (Bevel recipe).
const IconTile = ({ tone, children }: { tone: "primary" | "accent" | "warning"; children: ReactNode }) => (
  <span
    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
      tone === "warning" ? "bg-warning/10 text-warning" : tone === "accent" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
    }`}
  >
    {children}
  </span>
);

const ClassBrowser = () => {
  const { type } = useParams<{ type: string }>();
  const { profile, user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const classType = type === "adult" ? "adult" : "children";
  const customerType = profile?.customer_type as string | null;
  const primaryIsAdult = customerType === "adult_dancer";
  const showBothEqual = !customerType || customerType === "both";
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<Record<string, PricingPlan>>({});
  const [children, setChildren] = useState<{ id: string; first_name: string; last_name: string; preferred_name: string | null; date_of_birth: string; expected_arrival_time: string | null; expected_departure_time: string | null }[]>([]);
  const [selfStudent, setSelfStudent] = useState<any>(null);
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [profileNudge, setProfileNudge] = useState<any>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<Record<string, string[]>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [classSessions, setClassSessions] = useState<Record<string, { id: string; session_date: string; start_time: string; end_time: string }[]>>({});
  const [selectedSessions, setSelectedSessions] = useState<Record<string, string[]>>({});
  const [hasExistingBookings, setHasExistingBookings] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState<"classes" | "camps" | "shows">("classes");
  const [quickBookClassId, setQuickBookClassId] = useState<string | null>(null);

  // Ability + gender filters ("all" = no filter applied)
  const [abilityFilter, setAbilityFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  // Postcode search
  const [postcode, setPostcode] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

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
      const { data } = await supabase
        .from("classes")
        .select(`*,
          venues(name, photo_outside, photo_indoor, photo_parking, address_line1, address_line2, city, postcode, latitude, longitude, directions, drop_off_info, has_parking, parking_details),
          staff(full_name, profile_photo, description, dance_skills),
          workshops(cover_image, name, description)`)
        .eq("is_active", true)
        .eq("publicly_visible", true)
        .eq("status", "confirmed")
        .eq("class_type", classType as any)
        .order("sort_order")
        .order("day_of_week")
        .order("start_time");
      if (data) {
        // Fetch all scheduled sessions for the listed classes in one query,
        // splitting upcoming from past client-side.
        const counts: Record<string, number> = {};
        const totalCounts: Record<string, number> = {};
        const sessions: Record<string, { id: string; session_date: string; start_time: string; end_time: string }[]> = {};
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
      }
      setLoading(false);
    };
    fetchClasses();
  }, [classType]);

  // Fetch camps
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("camps")
      .select("*, venues(name, address_line1, city, postcode, latitude, longitude), workshops(cover_image, name)")
      .eq("is_active", true)
      .eq("class_type", classType as any)
      .gte("end_date", today)
      .order("start_date")
      .then(({ data }) => { if (data) setCamps(data); });
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

  // Helper: calculate age from DOB
  const getAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  // Which children match a class's age range?
  const getMatchingChildren = (c: { age_min: number | null; age_max: number | null }) => {
    if (!children.length) return [];
    return children.filter(child => {
      const age = getAge(child.date_of_birth);
      const minOk = c.age_min == null || age >= c.age_min;
      const maxOk = c.age_max == null || age <= c.age_max;
      return minOk && maxOk;
    });
  };

  // Effective coords: manual search overrides home coords
  const effectiveCoords = searchCoords || homeCoords;

  // Apply ability + gender filters before sorting.
  // ability_level is a MINIMUM: selecting a level shows classes whose minimum
  // is that level or lower (e.g. an Intermediate dancer also sees Beginner/Improver).
  // gender: Mixed always shows; Boys filter shows Boys + Mixed; Girls shows Girls + Mixed.
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (abilityFilter !== "all") {
        if (abilityRank(c.ability_level) > abilityRank(abilityFilter)) return false;
      }
      if (genderFilter !== "all") {
        const g = normaliseGender(c.gender);
        if (g !== "mixed" && g !== genderFilter) return false;
      }
      return true;
    });
  }, [classes, abilityFilter, genderFilter]);

  // Sort: age-matched classes first, then by distance
  const sortedClasses = useMemo(() => {
    const scored = filteredClasses.map(c => {
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
  }, [filteredClasses, effectiveCoords, children]);

  const getDistance = (c: ClassItem) => {
    if (!effectiveCoords) return null;
    const v = c.venues as VenueData | null;
    if (!v?.latitude || !v?.longitude) return null;
    return haversineDistance(effectiveCoords.lat, effectiveCoords.lon, v.latitude, v.longitude);
  };

  const isAdult = classType === "adult";

  const venuePhotos = (c: ClassItem) => {
    const v = c.venues as VenueData | null;
    if (!v) return null;
    return { indoor: v.photo_indoor, outside: v.photo_outside, parking: v.photo_parking, name: v.name };
  };

  return (
    <div className="relative min-h-[80vh] overflow-hidden bg-background transition-colors duration-500">
      {/* Themed ambient wash */}
      <AmbientGlow variant={isAdult ? "night" : "light"} />

      <div className="container relative z-10 max-w-6xl py-8 md:py-12">
        {/* Page title */}
        <FadeRise className="mb-8 text-center md:mb-10">
          <span className="eyebrow inline-flex items-center justify-center gap-1.5">
            {isAdult ? <Heart className="h-3.5 w-3.5 text-primary" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            {isAdult ? "Adult classes" : "Children's classes"}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            {isAdult ? "Book adult dance classes in Essex" : "Book children's dance classes in Essex"}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            {isAdult
              ? "Our adult classes are designed for all levels. Step out of your comfort zone and into the spotlight."
              : "Fun, high-energy dance classes for children across Essex. Watch them grow in confidence and skill!"}
          </p>
        </FadeRise>

        {/* Floating filter bar: audience toggle + postcode + filters */}
        <FadeRise delay={80} className="mx-auto mb-6 max-w-3xl">
          <div className="space-y-3 rounded-3xl bg-card p-3 shadow-soft-md md:p-4 dark:border dark:border-border/60">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Children / Adults segmented toggle */}
              <div className="inline-flex items-center rounded-full bg-secondary p-1">
                {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((tabType) => {
                  const tabIsAdult = tabType === "adult";
                  const tabIsActive = tabIsAdult === isAdult;
                  const isSecondary = !showBothEqual && (
                    (customerType === "parent_only" && tabIsAdult) ||
                    (customerType === "adult_dancer" && !tabIsAdult)
                  );

                  return (
                    <Link
                      key={tabType}
                      to={`/classes/${tabType}`}
                      className={`inline-flex items-center gap-1.5 rounded-full py-2 font-semibold transition-all duration-300 ${
                        tabIsActive
                          ? "bg-card px-4 text-sm text-foreground shadow-soft"
                          : isSecondary
                            ? "px-3 text-xs text-muted-foreground/60 hover:text-muted-foreground"
                            : "px-4 text-sm text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tabIsAdult ? <Heart className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {tabIsAdult ? "Adults" : "Children"}
                    </Link>
                  );
                })}
              </div>

              {/* Postcode search */}
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search by postcode to find nearest classes"
                  placeholder="Enter your postcode to find nearest classes..."
                  value={postcode}
                  onChange={e => setPostcode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePostcodeSearch()}
                  className="rounded-full pl-10 pr-8"
                />
                {searchCoords && (
                  <button type="button" aria-label="Clear postcode search" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={handlePostcodeSearch}
                disabled={searchLoading || !postcode.trim()}
                size="default"
              >
                {searchLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Ability + for filters */}
            {activeSection === "classes" && (
              <div className="flex flex-wrap items-end justify-center gap-3 border-t border-border/50 pt-3">
                <div className="flex flex-col gap-1">
                  <span className="eyebrow pl-1">Ability</span>
                  <Select value={abilityFilter} onValueChange={setAbilityFilter}>
                    <SelectTrigger className="w-[180px] text-sm" aria-label="Filter by ability level">
                      <SelectValue placeholder="All abilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All abilities</SelectItem>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Improver">Improver &amp; below</SelectItem>
                      <SelectItem value="Intermediate">Intermediate &amp; below</SelectItem>
                      <SelectItem value="Advanced">Advanced &amp; below</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="eyebrow pl-1">For</span>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="w-[150px] text-sm" aria-label="Filter by who the class is for">
                      <SelectValue placeholder="Everyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="boys">Boys</SelectItem>
                      <SelectItem value="girls">Girls</SelectItem>
                      <SelectItem value="mixed">Mixed only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(abilityFilter !== "all" || genderFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setAbilityFilter("all"); setGenderFilter("all"); }}
                    className="mb-0.5 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {searchError && <p className="mt-2 text-center text-sm text-destructive">{searchError}</p>}
          {searchCoords && !searchError && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Showing classes sorted by distance from <span className="font-medium text-primary">{postcode.toUpperCase()}</span>
            </p>
          )}
          {!searchCoords && homeCoords && !searchError && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Sorted by distance from your home address
            </p>
          )}
        </FadeRise>

        {/* Section navigation pills */}
        <FadeRise delay={140} className="mb-8 flex flex-wrap justify-center gap-2 md:mb-10">
          {[
            { key: "classes" as const, label: "Classes", icon: CalendarDays, count: sortedClasses.length },
            ...(!isAdult ? [{ key: "camps" as const, label: "School holiday & weekend events", icon: Music, count: camps.length }] : []),
            { key: "shows" as const, label: "Shows & performances", icon: Ticket, count: shows.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => {
                setActiveSection(key);
                document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                activeSection === key
                  ? "bg-primary text-primary-foreground shadow-soft-md"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className={`ml-1 px-1.5 py-0 text-[10px] tabular-nums ${activeSection === key ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
                >
                  {count}
                </Badge>
              )}
            </button>
          ))}
        </FadeRise>

        {/* CLASSES SECTION */}
        <div id="section-classes" className={activeSection !== "classes" ? "hidden" : ""}>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading classes...</div>
        ) : sortedClasses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              {(abilityFilter !== "all" || genderFilter !== "all") && classes.length > 0 ? (
                <div className="space-y-3">
                  <p>No classes match your current filters.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAbilityFilter("all"); setGenderFilter("all"); }}
                    className="gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </Button>
                </div>
              ) : (
                <>No {classType} classes available right now. Check back soon!</>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            {sortedClasses.map(({ cls: c, matched: matchedChildren }, i) => {
              const photos = venuePhotos(c);
              const workshopImage = getWorkshopImageUrl((c.workshops as any)?.cover_image);
              const heroPhoto = workshopImage || photos?.indoor || photos?.outside;
              const heroAlt = workshopImage ? ((c.workshops as any)?.name || c.name) : (photos?.name || "Venue");
              const hasGallery = photos && (photos.indoor || photos.outside || photos.parking);
              const galleryCount = photos ? [photos.indoor, photos.outside, photos.parking].filter(Boolean).length : 0;
              const dateRange = formatDateRange(c.term_start, c.term_end);
              const daysLabel = formatDays(c.days_of_week?.length ? c.days_of_week : [c.day_of_week]);
              const isExpanded = expandedId === c.id;
              const distance = getDistance(c);
              const venue = c.venues as VenueData | null;
              const staff = c.staff as StaffData | null;
              const staffPhoto = getStaffPhotoUrl(staff?.profile_photo || null);
              const workshop = c.workshops as { cover_image: string | null; name: string; description: string | null } | null;
              const childNames = matchedChildren.map(ch => ch.preferred_name || ch.first_name);

              return (
                <FadeRise key={c.id} delay={Math.min(i, 5) * 60} className="h-full">
                  <Card className="group h-full overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                    {/* Workshop/venue photo tile */}
                    {heroPhoto && (
                      <div className="relative mx-4 mt-4 h-44 overflow-hidden rounded-2xl">
                        <img
                          src={heroPhoto}
                          alt={heroAlt}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        {/* Distance badge */}
                        {distance !== null && (
                          <div className="absolute left-3 top-3">
                            <Badge variant="solid" className="gap-1 text-xs font-semibold shadow-soft-md">
                              <Navigation className="h-3 w-3" />
                              {distance < 1 ? `${(distance * 1760).toFixed(0)} yards` : `${distance.toFixed(1)} miles`}
                            </Badge>
                          </div>
                        )}
                        {hasGallery && galleryCount > 1 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="secondary" size="sm" className="absolute bottom-2 right-2 gap-1 bg-card/85 text-xs text-foreground backdrop-blur hover:bg-card">
                                <Camera className="h-3 w-3" /> {galleryCount} photos
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogTitle className="font-display text-lg font-bold">{photos?.name}</DialogTitle>
                              <div className="mt-2 grid gap-4">
                                {photos?.indoor && (
                                  <div>
                                    <p className="eyebrow mb-1.5">Dance space</p>
                                    <img src={photos.indoor} alt="Indoor dance space" className="max-h-64 w-full rounded-2xl object-cover" />
                                  </div>
                                )}
                                {photos?.outside && (
                                  <div>
                                    <p className="eyebrow mb-1.5">Outside</p>
                                    <img src={photos.outside} alt="Outside view" className="max-h-64 w-full rounded-2xl object-cover" />
                                  </div>
                                )}
                                {photos?.parking && (
                                  <div>
                                    <p className="eyebrow mb-1.5 flex items-center gap-1"><Car className="h-3 w-3" /> Parking</p>
                                    <img src={photos.parking} alt="Parking area" className="max-h-64 w-full rounded-2xl object-cover" />
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    )}

                    {/* Personalized recommendation banner */}
                    {childNames.length > 0 && classType === "children" && (
                      <div className="px-6 pt-4">
                        <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2">
                          <Star className="h-4 w-4 shrink-0 text-primary" />
                          <span className="text-xs font-semibold text-primary">
                            {childNames.length === 1
                              ? `${childNames[0]} might love this!`
                              : `Great for ${childNames.slice(0, -1).join(", ")} & ${childNames[childNames.length - 1]}!`}
                          </span>
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.dance_style && (
                            <Badge className="text-xs">{c.dance_style}</Badge>
                          )}
                          {c.ability_level && (
                            <Badge variant="secondary" className="text-[10px]">{c.ability_level}</Badge>
                          )}
                          {(() => {
                            const g = normaliseGender(c.gender);
                            if (g === "mixed") return null;
                            return (
                              <Badge variant={g === "boys" ? "default" : "accent"} className="text-[10px]">
                                {g === "boys" ? "Boys" : "Girls"}
                              </Badge>
                            );
                          })()}
                          {c.invite_only && (
                            <Badge variant="warning" className="text-[10px]">
                              Invite only
                            </Badge>
                          )}
                        </div>
                        {audienceText(c) && (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">{audienceText(c)}</span>
                        )}
                      </div>
                      <CardTitle className="text-xl transition-colors group-hover:text-primary">{c.name}</CardTitle>
                      {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                    </CardHeader>
                    <CardContent>
                      {/* Schedule rows */}
                      <div className="mb-4 space-y-2.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <IconTile tone="primary"><CalendarDays className="h-4 w-4" /></IconTile>
                          <span>{daysLabel}{dateRange && <span className="ml-1 text-muted-foreground/70">· {dateRange}</span>}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <IconTile tone="primary"><Clock className="h-4 w-4" /></IconTile>
                          <span>{c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}</span>
                        </div>
                        {venue && (
                          <div className="flex items-center gap-3">
                            <IconTile tone="primary"><MapPin className="h-4 w-4" /></IconTile>
                            <span>{venue.name}</span>
                          </div>
                        )}
                        {staff && (
                          <div className="flex items-center gap-3">
                            <IconTile tone="primary"><Users className="h-4 w-4" /></IconTile>
                            <span>{staff.full_name} <span className="eyebrow ml-1">Instructor</span></span>
                          </div>
                        )}
                      </div>

                      {/* Invite-only sessions are visible but never open-enrolment bookable */}
                      {c.invite_only && (
                        <div className="mb-3 flex items-start gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-xs text-warning">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>This is an invite-only session. Places are offered directly by The Dance Exclusive team — please contact us if you think this crew is for you.</span>
                        </div>
                      )}

                      {/* Action buttons: Book now (primary) + More info (secondary) */}
                      <div className="mb-4 flex items-stretch gap-2">
                        {isClassBookable(c) ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!user) { navigate("/auth"); return; }
                              setQuickBookClassId(c.id);
                            }}
                            className="flex-1 gap-1.5"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Book now
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled
                            className="flex-1 gap-1.5"
                            variant="secondary"
                          >
                            {c.invite_only ? "Invite only" : "Booking opening soon"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          <Info className="h-3.5 w-3.5" />
                          {isExpanded ? "Less info" : "More info"}
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <FadeRise className="space-y-5 rounded-2xl border border-border/60 p-4">
                          {/* Instructor section */}
                          {staff && (
                            <div className="flex gap-4">
                              {staffPhoto ? (
                                <img
                                  src={staffPhoto}
                                  alt={staff.full_name}
                                  className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                                />
                              ) : (
                                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                  <Users className="h-6 w-6 text-primary/60" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">{staff.full_name}</p>
                                <p className="eyebrow mb-1 text-primary">Instructor</p>
                                {staff.description && (
                                  <p className="line-clamp-3 text-xs text-muted-foreground">
                                    {staff.description}
                                  </p>
                                )}
                                {staff.dance_skills?.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {staff.dance_skills.slice(0, 5).map(s => (
                                      <Badge key={s} variant="secondary" className="py-0 text-[10px]">{s}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Workshop description */}
                          {workshop?.description && (
                            <div>
                              <p className="eyebrow mb-1">About this class</p>
                              <p className="text-sm text-muted-foreground">
                                {workshop.description}
                              </p>
                            </div>
                          )}

                          {/* Venue details */}
                          {venue && (
                            <div className="space-y-2 rounded-2xl bg-secondary/50 p-4">
                              <p className="eyebrow flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Venue
                              </p>
                              <p className="text-sm font-semibold text-foreground">{venue.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {venue.address_line1}
                                {venue.address_line2 && `, ${venue.address_line2}`}
                                {`, ${venue.city}`}
                                {`, ${venue.postcode}`}
                              </p>
                              {venue.directions && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Directions: </span>{venue.directions}
                                </p>
                              )}
                              {venue.drop_off_info && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Drop-off: </span>{venue.drop_off_info}
                                </p>
                              )}
                              {venue.has_parking && venue.parking_details && (
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Car className="h-3 w-3 text-primary" />
                                  <span className="font-medium text-foreground">Parking: </span>{venue.parking_details}
                                </p>
                              )}

                              {/* Driving directions button */}
                              {venue.latitude && venue.longitude && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 w-full gap-2 text-xs text-primary"
                                  >
                                    <Navigation className="h-3.5 w-3.5" />
                                    Get driving directions
                                  </Button>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Pricing plan selector */}
                          {(c.price_per_session || c.price_per_month || c.price_per_term) && (() => {
                            const remaining = sessionCounts[c.id] || 0;
                            const plan = selectedPlans[c.id] || "session";
                            const termSavings = c.price_per_session && c.price_per_term && remaining > 0
                              ? Math.round((1 - c.price_per_term / (c.price_per_session * remaining)) * 100)
                              : c.term_discount_percent || 0;
                            const annualMonthlyCost = c.price_per_year ? c.price_per_year / 12 : null;
                            const annualSavings = c.price_per_session && c.price_per_year
                              ? Math.round((1 - (c.price_per_year / 12) / (c.price_per_session * 4)) * 100)
                              : c.monthly_discount_percent || 0;
                            const sessions = classSessions[c.id] || [];
                            const selSessions = selectedSessions[c.id] || [];
                            const toggleSession = (sessionId: string) => {
                              setSelectedSessions(p => {
                                const current = p[c.id] || [];
                                const next = current.includes(sessionId)
                                  ? current.filter(id => id !== sessionId)
                                  : [...current, sessionId];
                                return { ...p, [c.id]: next };
                              });
                            };
                            const selectAllSessions = () => {
                              setSelectedSessions(p => ({ ...p, [c.id]: sessions.map(s => s.id) }));
                              setSelectedPlans(p => ({ ...p, [c.id]: "term" }));
                            };

                            return (
                              <div className="space-y-3 rounded-2xl bg-secondary/50 p-4">
                                <p className="eyebrow flex items-center gap-1">
                                  <Tag className="h-3 w-3" /> Choose your plan
                                </p>
                                {remaining > 0 && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {remaining} session{remaining !== 1 ? "s" : ""} remaining this term
                                  </p>
                                )}
                                <div className="grid gap-2">
                                  {/* Drop-in sessions */}
                                  {c.price_per_session && (
                                    <button
                                      onClick={() => { setSelectedPlans(p => ({ ...p, [c.id]: "session" })); setSelectedSessions(p => ({ ...p, [c.id]: [] })); }}
                                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-sm transition-all ${
                                        plan === "session"
                                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                          : "border-border/60 bg-card hover:border-border"
                                      }`}
                                    >
                                      <div>
                                        <span className="font-semibold text-foreground">Drop-in sessions</span>
                                        <span className="block text-[10px] text-muted-foreground">Pick the dates you want to attend</span>
                                      </div>
                                      <span className="font-display font-bold tabular-nums text-foreground">£{c.price_per_session}<span className="text-[10px] font-normal text-muted-foreground">/each</span></span>
                                    </button>
                                  )}

                                  {/* Full term */}
                                  {c.price_per_term && remaining > 0 && (
                                    <button
                                      onClick={() => selectAllSessions()}
                                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-sm transition-all ${
                                        plan === "term"
                                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                          : "border-border/60 bg-card hover:border-border"
                                      }`}
                                    >
                                      <div>
                                        <span className="font-semibold text-foreground">Full term</span>
                                        <span className="block text-[10px] text-muted-foreground">All {remaining} sessions · save vs drop-in</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-display font-bold tabular-nums text-foreground">£{c.price_per_term}</span>
                                        {termSavings > 0 && (
                                          <Badge variant="success" className="ml-1.5 text-[9px]">
                                            Save {termSavings}%
                                          </Badge>
                                        )}
                                      </div>
                                    </button>
                                  )}

                                  {/* Monthly subscription */}
                                  {(c.price_per_year || c.price_per_month) && (
                                    <button
                                      onClick={() => { setSelectedPlans(p => ({ ...p, [c.id]: "monthly" })); setSelectedSessions(p => ({ ...p, [c.id]: sessions.map(s => s.id) })); }}
                                      className={`relative flex items-center justify-between rounded-xl border p-2.5 text-left text-sm transition-all ${
                                        plan === "monthly"
                                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                          : "border-border/60 bg-card hover:border-border"
                                      }`}
                                    >
                                      <div className="absolute -top-2 right-2">
                                        <Badge variant="solid" className="px-1.5 py-0 text-[9px]">Best value</Badge>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-foreground">Monthly subscription</span>
                                        <span className="block text-[10px] text-muted-foreground">Commit for the year · cheapest per class</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-display font-bold tabular-nums text-foreground">
                                          £{annualMonthlyCost?.toFixed(2) || c.price_per_month}
                                          <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                                        </span>
                                        {annualSavings > 0 && (
                                          <Badge variant="success" className="ml-1.5 text-[9px]">
                                            Save {annualSavings}%
                                          </Badge>
                                        )}
                                      </div>
                                    </button>
                                  )}
                                </div>

                                {/* Session date picker — for drop-in */}
                                {plan === "session" && sessions.length > 0 && (
                                  <div className="space-y-2 border-t border-border/50 pt-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[11px] font-medium text-muted-foreground">Select sessions to attend:</p>
                                      <button
                                        onClick={() => setSelectedSessions(p => ({
                                          ...p,
                                          [c.id]: selSessions.length === sessions.length ? [] : sessions.map(s => s.id)
                                        }))}
                                        className="text-[10px] text-primary hover:underline"
                                      >
                                        {selSessions.length === sessions.length ? "Deselect all" : "Select all"}
                                      </button>
                                    </div>
                                    <div className="grid max-h-48 gap-1.5 overflow-y-auto pr-1">
                                      {sessions.map(s => {
                                        const isSelected = selSessions.includes(s.id);
                                        return (
                                          <label
                                            key={s.id}
                                            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-sm transition-all ${
                                              isSelected
                                                ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                                : "border-border/60 bg-card hover:border-border"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleSession(s.id)}
                                              className="h-4 w-4 rounded border-border accent-primary"
                                            />
                                            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                                            <span className="flex-1 font-medium text-foreground">
                                              {format(parseISO(s.session_date), "EEE d MMM yyyy")}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {selSessions.length > 0 && (
                                      <p className="text-[11px] font-medium text-primary">
                                        {selSessions.length} session{selSessions.length !== 1 ? "s" : ""} selected · £{(c.price_per_session! * selSessions.length).toFixed(2).replace(/\.00$/, '')}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Child selector for children's classes */}
                                {c.class_type === "children" && user && children.length > 0 && (() => {
                                  const getChildAge = (dob: string) => {
                                    const birth = new Date(dob);
                                    const today = new Date();
                                    let age = today.getFullYear() - birth.getFullYear();
                                    const m = today.getMonth() - birth.getMonth();
                                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                                    return age;
                                  };
                                  const eligibleChildren = children.map(ch => {
                                    const age = getChildAge(ch.date_of_birth);
                                    const tooYoung = c.age_min != null && age < c.age_min;
                                    const tooOld = c.age_max != null && age > c.age_max;
                                    const alreadyAdded = cartItems.some(ci => ci.classId === c.id && ci.studentId === ch.id);
                                    return { ...ch, age, eligible: !tooYoung && !tooOld, alreadyAdded };
                                  });
                                  const hasEligible = eligibleChildren.some(ch => ch.eligible);
                                  const selected = selectedChildren[c.id] || [];
                                  const toggleChild = (childId: string) => {
                                    setSelectedChildren(p => {
                                      const current = p[c.id] || [];
                                      const next = current.includes(childId)
                                        ? current.filter(id => id !== childId)
                                        : [...current, childId];
                                      return { ...p, [c.id]: next };
                                    });
                                  };
                                  return (
                                    <div className="space-y-1.5 border-t border-border/50 pt-2">
                                      <p className="text-[11px] font-medium text-muted-foreground">Select children to add:</p>
                                      {!hasEligible && (
                                        <p className="text-[11px] text-warning">
                                          None of your children are in the age range{c.age_min != null && c.age_max != null ? ` (ages ${c.age_min}–${c.age_max})` : ""}.
                                        </p>
                                      )}
                                      {eligibleChildren.map(ch => (
                                        <label
                                          key={ch.id}
                                          className={`flex items-center gap-2.5 rounded-xl border p-2 text-sm transition-all ${
                                            !ch.eligible
                                              ? "cursor-not-allowed border-border/40 bg-secondary/40 opacity-40"
                                              : ch.alreadyAdded
                                                ? "cursor-not-allowed border-success/30 bg-success/5 opacity-60"
                                                : selected.includes(ch.id)
                                                  ? "cursor-pointer border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                                  : "cursor-pointer border-border/60 bg-card hover:border-border"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selected.includes(ch.id) || ch.alreadyAdded}
                                            disabled={!ch.eligible || ch.alreadyAdded}
                                            onChange={() => toggleChild(ch.id)}
                                            className="h-4 w-4 rounded border-border accent-primary"
                                          />
                                          <span className="flex-1 font-medium text-foreground">
                                            {ch.first_name} {ch.last_name}
                                            <span className="ml-1 font-normal text-muted-foreground">(age {ch.age})</span>
                                          </span>
                                          {!ch.eligible && <span className="text-[10px] text-warning">not in age group</span>}
                                          {ch.alreadyAdded && <span className="text-[10px] text-success">in basket</span>}
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })()}

                                {/* No children yet — prompt to add one */}
                                {c.class_type === "children" && user && children.length === 0 && (
                                  <div className="border-t border-border/50 pt-2">
                                    <div className="space-y-2 rounded-xl bg-warning/10 p-3 text-sm">
                                      <p className="text-foreground">
                                        Add your child's details to book them into this class.
                                      </p>
                                      <Button size="sm" onClick={() => setAddChildOpen(true)} className="gap-1.5">
                                        <UserPlus className="h-3.5 w-3.5" /> Add a child
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Add to basket inside the plan area */}
                                {(() => {
                                  const sessionsSelected = selSessions.length;
                                  const price = plan === "term" ? c.price_per_term
                                    : plan === "monthly" ? (annualMonthlyCost || c.price_per_month)
                                    : c.price_per_session;
                                  const selectedKids = selectedChildren[c.id] || [];
                                  const allSelectedInCart = c.class_type === "children" && selectedKids.length > 0
                                    && selectedKids.every(sid => cartItems.some(ci => ci.classId === c.id && ci.studentId === sid));
                                  // Must pick at least one attendee for a children's class.
                                  const noKidsSelected = c.class_type === "children" && selectedKids.length === 0;
                                  const noSessionsSelected = plan === "session" && sessionsSelected === 0;

                                  const totalForDropIn = plan === "session" && c.price_per_session ? c.price_per_session * sessionsSelected : price;
                                  const kidCount = selectedKids.length || 1;
                                  const displayPrice = plan === "session" ? (totalForDropIn || 0) * kidCount : (price || 0) * kidCount;

                                  const sessionDates = selSessions.map(sid => {
                                    const s = sessions.find(ss => ss.id === sid);
                                    return s ? format(parseISO(s.session_date), "d MMM") : "";
                                  });

                                  const handleAddToCart = () => {
                                    if (!isClassBookable(c)) return;
                                    if (!user) { navigate("/auth"); return; }
                                    if (noKidsSelected) return;
                                    if (noSessionsSelected) return;

                                    // Every booking needs a complete attendee profile for the register.
                                    if (c.class_type === "adult") {
                                      if (!isAttendeeProfileComplete(selfStudent)) {
                                        setSelfDialogOpen(true);
                                        return;
                                      }
                                    } else {
                                      const incomplete = selectedKids
                                        .map(kid => children.find(ch => ch.id === kid))
                                        .find(ch => ch && !isAttendeeProfileComplete(ch as any));
                                      if (incomplete) {
                                        setProfileNudge(incomplete);
                                        return;
                                      }
                                    }

                                    const buildItem = (childId: string | null, childName: string | null) => ({
                                      id: `${c.id}-${childId || 'self'}-${Date.now()}-${Math.random()}`,
                                      classId: c.id,
                                      className: c.name,
                                      classType: c.class_type as "children" | "adult",
                                      danceStyle: c.dance_style,
                                      dayOfWeek: c.day_of_week,
                                      startTime: c.start_time,
                                      endTime: c.end_time,
                                      venueName: (c.venues as VenueData | null)?.name || null,
                                      studentId: childId,
                                      studentName: childName,
                                      pricingPlan: plan,
                                      unitPrice: plan === "session" ? (c.price_per_session || 0) : (price || 0),
                                      totalPrice: plan === "session" ? (c.price_per_session || 0) * sessionsSelected : (price || 0),
                                      sessionsCount: plan === "term" ? remaining : plan === "session" ? sessionsSelected : null,
                                      termDiscountPercent: plan === "term" ? (c.term_discount_percent || null) : null,
                                      workshopImage: getWorkshopImageUrl((c.workshops as any)?.cover_image),
                                      selectedSessionIds: selSessions,
                                      selectedSessionDates: sessionDates,
                                    });

                                    if (c.class_type === "children" && selectedKids.length > 0) {
                                      for (const childId of selectedKids) {
                                        if (cartItems.some(ci => ci.classId === c.id && ci.studentId === childId)) continue;
                                        const child = children.find(ch => ch.id === childId);
                                        addItem(buildItem(childId, child ? `${child.first_name} ${child.last_name}` : null));
                                      }
                                      setSelectedChildren(p => ({ ...p, [c.id]: [] }));
                                    } else {
                                      // Adult self-booking always carries the self attendee profile.
                                      addItem(buildItem(selfStudent.id, `${selfStudent.first_name} ${selfStudent.last_name}`));
                                    }
                                  };

                                  const priceLabel = plan === "term" ? "term"
                                    : plan === "monthly" ? "mo"
                                    : sessionsSelected > 1 ? `${sessionsSelected} sessions` : "session";

                                  return (
                                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                                      <div>
                                        {displayPrice ? (
                                          <span className="font-display text-lg font-bold tabular-nums text-foreground">
                                            £{displayPrice.toFixed(2).replace(/\.00$/, '')}
                                            <span className="ml-0.5 text-xs font-normal text-muted-foreground">/{priceLabel}</span>
                                            {(c.class_type === "children" ? selectedKids.length : 0) > 1 && (
                                              <span className="ml-1 text-xs font-normal text-muted-foreground">× {selectedKids.length} children</span>
                                            )}
                                          </span>
                                        ) : null}
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={!isClassBookable(c) || allSelectedInCart || noKidsSelected || noSessionsSelected}
                                        onClick={handleAddToCart}
                                        className="gap-1.5"
                                      >
                                        <ShoppingCart className="h-3.5 w-3.5" />
                                        {allSelectedInCart ? "In basket"
                                          : noSessionsSelected ? "Select sessions"
                                          : selectedKids.length > 1 ? `Add ${selectedKids.length} to basket`
                                          : "Add to basket"}
                                      </Button>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </FadeRise>
                      )}
                    </CardContent>
                  </Card>
                </FadeRise>
              );
            })}
          </div>
        )}
        </div>

        {/* CAMPS SECTION — children only */}
        {!isAdult && <div id="section-camps" className={activeSection !== "camps" ? "hidden" : ""}>
          {camps.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Music className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                No upcoming camps right now. Check back soon!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
              {[...camps].sort((a: any, b: any) => {
                const aMatch = getMatchingChildren(a).length > 0 ? 0 : 1;
                const bMatch = getMatchingChildren(b).length > 0 ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
                if (!effectiveCoords) return 0;
                const aDist = a.venues?.latitude && a.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, a.venues.latitude, a.venues.longitude) : 9999;
                const bDist = b.venues?.latitude && b.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, b.venues.latitude, b.venues.longitude) : 9999;
                return aDist - bDist;
              }).map((camp: any, i: number) => {
                const workshopImage = getWorkshopImageUrl(camp.workshops?.cover_image);
                const venue = camp.venues;
                const campMatchedChildren = getMatchingChildren(camp);
                const campChildNames = campMatchedChildren.map((ch: any) => ch.preferred_name || ch.first_name);
                return (
                  <FadeRise key={camp.id} delay={Math.min(i, 5) * 60} className="h-full">
                    <Card className="h-full overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                      {workshopImage && (
                        <div className="relative mx-4 mt-4 h-44 overflow-hidden rounded-2xl">
                          <img src={workshopImage} alt={camp.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                          <Badge className="absolute left-3 top-3 gap-1 bg-warning text-warning-foreground shadow-soft-md">
                            <Music className="h-3 w-3" /> Event
                          </Badge>
                        </div>
                      )}
                      {campChildNames.length > 0 && (
                        <div className="px-6 pt-4">
                          <div className="flex items-center gap-2 rounded-2xl bg-warning/10 px-3 py-2">
                            <Star className="h-4 w-4 shrink-0 text-warning" />
                            <span className="text-xs font-semibold text-warning">
                              {campChildNames.length === 1
                                ? `Perfect for ${campChildNames[0]}!`
                                : `Great for ${campChildNames.slice(0, -1).join(", ")} & ${campChildNames[campChildNames.length - 1]}!`}
                            </span>
                          </div>
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">{camp.name}</CardTitle>
                        {camp.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{camp.description}</p>}
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 space-y-2.5 text-sm text-muted-foreground">
                          {camp.start_date && camp.end_date && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="warning"><CalendarDays className="h-4 w-4" /></IconTile>
                              <span>{format(parseISO(camp.start_date), "d MMM")} – {format(parseISO(camp.end_date), "d MMM yyyy")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <IconTile tone="warning"><Clock className="h-4 w-4" /></IconTile>
                            <span>{camp.start_time?.slice(0, 5)} – {camp.end_time?.slice(0, 5)}</span>
                          </div>
                          {venue && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="warning"><MapPin className="h-4 w-4" /></IconTile>
                              <span>{venue.name}</span>
                            </div>
                          )}
                          {camp.age_min != null && camp.age_max != null && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="warning"><Users className="h-4 w-4" /></IconTile>
                              <span>Ages {camp.age_min}–{camp.age_max}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-border/50 pt-4">
                          <div>
                            {camp.price_per_day && <span className="font-display text-lg font-bold tabular-nums text-foreground">£{camp.price_per_day}<span className="text-xs font-normal text-muted-foreground">/day</span></span>}
                            {camp.price_total && !camp.price_per_day && <span className="font-display text-lg font-bold tabular-nums text-foreground">£{camp.price_total}<span className="text-xs font-normal text-muted-foreground"> total</span></span>}
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90"
                            onClick={() => { if (!user) navigate("/auth"); }}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> Book camp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </FadeRise>
                );
              })}
            </div>
          )}
        </div>}

        {/* SHOWS SECTION */}
        <div id="section-shows" className={activeSection !== "shows" ? "hidden" : ""}>
          {shows.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Ticket className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                No upcoming shows right now. Check back soon!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
              {shows.map((show: any, i: number) => {
                const venue = show.venues;
                return (
                  <FadeRise key={show.id} delay={Math.min(i, 5) * 60} className="h-full">
                    <Card className="h-full overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                      {show.cover_image && (
                        <div className="relative mx-4 mt-4 h-44 overflow-hidden rounded-2xl">
                          <img src={show.cover_image} alt={show.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="accent" className="gap-0.5 text-[10px]">
                            <Star className="h-3 w-3" /> Show
                          </Badge>
                          {show.dance_style && (
                            <Badge className="text-xs">{show.dance_style}</Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{show.name}</CardTitle>
                        {show.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{show.description}</p>}
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 space-y-2.5 text-sm text-muted-foreground">
                          {show.show_date && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="accent"><CalendarDays className="h-4 w-4" /></IconTile>
                              <span>{format(parseISO(show.show_date), "EEEE d MMMM yyyy")}</span>
                            </div>
                          )}
                          {show.show_time && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="accent"><Clock className="h-4 w-4" /></IconTile>
                              <span>Doors {show.show_time.slice(0, 5)}{show.duration_minutes ? ` · ${show.duration_minutes} mins` : ""}</span>
                            </div>
                          )}
                          {venue && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="accent"><MapPin className="h-4 w-4" /></IconTile>
                              <span>{venue.name}, {venue.city}</span>
                            </div>
                          )}
                          {show.capacity && (
                            <div className="flex items-center gap-3">
                              <IconTile tone="accent"><Users className="h-4 w-4" /></IconTile>
                              <span>{show.capacity - (show.tickets_sold || 0)} tickets remaining</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-border/50 pt-4">
                          <div>
                            {show.ticket_price ? (
                              <span className="font-display text-lg font-bold tabular-nums text-foreground">£{show.ticket_price}<span className="text-xs font-normal text-muted-foreground">/ticket</span></span>
                            ) : (
                              <span className="font-display text-lg font-bold text-success">Free</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                            onClick={() => { if (!user) navigate("/auth"); }}
                          >
                            <Ticket className="h-3.5 w-3.5" /> Get tickets
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </FadeRise>
                );
              })}
            </div>
          )}
        </div>

      </div>

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
    </div>
  );
};

export default ClassBrowser;
