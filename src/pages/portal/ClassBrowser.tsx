import { useEffect, useState, useMemo } from "react";
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
import {
  CalendarDays, Clock, MapPin, Users, Sparkles, Heart, Camera, Car, Navigation,
  ChevronDown, ChevronUp, Search, X, Info, ShoppingCart, Tag, Ticket, Crown, Music, UserPlus
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { audienceText, isClassBookable } from "@/lib/classAudience";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuickBookDialog } from "@/components/portal/QuickBookDialog";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import { CampBookDialog } from "@/components/portal/CampBookDialog";
import { AdultPassesCard } from "@/components/portal/AdultPassesCard";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import {
  MONTHLY_MEMBERSHIP_NOTICE,
  MONTHLY_PAYMENT_INFO,
  monthlyPrice,
  sessionPrice,
  termPrice,
  termlySavingsPercent,
  yearlyPrice,
  yearlySavingsPercent,
} from "@/lib/pricing";

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
  workshops: { cover_image: string | null; cover_position: string | null; name: string; description: string | null } | null;
}

/** Public pages show instructors by first name only. */
const instructorFirstName = (fullName: string | null | undefined) =>
  (fullName ?? "").trim().split(/\s+/)[0] || null;

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
  const [bookCampId, setBookCampId] = useState<string | null>(null);
  // Monthly membership cancellation-notice acknowledgement (inline plan panel).
  const [monthlyNotice, setMonthlyNotice] = useState<{ proceed: () => void } | null>(null);

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
          workshops(cover_image, cover_position, name, description)`)
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
      .select("*, venues(name, address_line1, city, postcode, latitude, longitude), workshops(cover_image, cover_position, name)")
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

  // Sort: age-matched classes first, then by distance
  const sortedClasses = useMemo(() => {
    const scored = classes.map(c => {
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
  }, [classes, effectiveCoords, children]);

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
    <div className="min-h-[80vh] bg-background transition-colors duration-500">
      {/* Themed background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl opacity-20 transition-all duration-700"
          style={{
            background: isAdult
              ? "radial-gradient(ellipse, hsl(330, 90%, 55%), transparent)"
              : "radial-gradient(ellipse, hsl(193, 100%, 44%), transparent)",
          }}
        />
      </div>

      <div className="container py-16 relative z-10">
        {/* Hero section */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold uppercase tracking-widest mb-6 transition-all duration-500"
            style={{
              background: isAdult ? "hsl(330, 90%, 55%)" : "hsl(193, 100%, 44%)",
              color: "white",
              boxShadow: isAdult
                ? "0 8px 32px hsl(330, 90%, 55%, 0.3)"
                : "0 8px 32px hsl(193, 100%, 44%, 0.3)",
            }}
          >
            {isAdult ? <Heart className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {isAdult ? "Adult Classes" : "Children's Classes"}
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground mb-4 tracking-tight">
            {isAdult ? "Book Adult Dance Classes in Essex" : "Book Children's Dance Classes in Essex"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
            {isAdult
              ? "Our adult classes are designed for all levels. Step out of your comfort zone and into the spotlight."
              : "Fun, high-energy dance classes for children across Essex. Watch them grow in confidence and skill!"}
          </p>

          <div className="flex gap-2 justify-center mt-8">
            {(primaryIsAdult ? ["adult", "children"] : ["children", "adult"]).map((tabType) => {
              const tabIsAdult = tabType === "adult";
              const tabIsActive = tabIsAdult === isAdult;
              const isSecondary = !showBothEqual && (
                (customerType === "parent_only" && tabIsAdult) ||
                (customerType === "adult_dancer" && !tabIsAdult)
              );

              return (
                <Link key={tabType} to={`/classes/${tabType}`}>
                  <Button
                    variant={tabIsActive ? "default" : "outline"}
                    size={isSecondary && !tabIsActive ? "sm" : "lg"}
                    className={`uppercase tracking-wider text-xs font-bold rounded-full px-8 transition-all duration-300 ${
                      tabIsActive
                        ? "text-primary-foreground"
                        : isSecondary
                          ? "border-border/50 bg-background/40 text-muted-foreground/50 hover:text-muted-foreground text-[10px] px-4"
                          : "border-border bg-background/80 text-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                    style={tabIsActive ? {
                      background: tabIsAdult ? "hsl(330, 90%, 55%)" : "hsl(193, 100%, 44%)",
                      boxShadow: tabIsAdult ? "0 4px 20px hsl(330, 90%, 55%, 0.3)" : "0 4px 20px hsl(193, 100%, 44%, 0.3)",
                    } : {}}
                  >
                    {tabIsAdult ? <Heart className="w-3.5 h-3.5 mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                    {tabIsAdult ? "Adults" : "Children"}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Postcode search bar */}
        <div className="max-w-md mx-auto mb-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                aria-label="Search by postcode to find nearest classes"
                placeholder="Enter your postcode to find nearest classes..."
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePostcodeSearch()}
                className="pl-9 pr-8 bg-card/80 border-border/50 text-foreground"
              />
              {searchCoords && (
                <button type="button" aria-label="Clear postcode search" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              onClick={handlePostcodeSearch}
              disabled={searchLoading || !postcode.trim()}
              size="default"
              style={{
                background: "hsl(193, 100%, 44%)",
                color: "white",
              }}
            >
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          {searchError && <p className="text-destructive text-sm mt-2 text-center">{searchError}</p>}
          {searchCoords && !searchError && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Showing classes sorted by distance from <span className="text-primary font-medium">{postcode.toUpperCase()}</span>
            </p>
          )}
          {!searchCoords && homeCoords && !searchError && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Sorted by distance from your home address
            </p>
          )}
        </div>

        {/* Adult multi-class passes + birthday class */}
        {isAdult && (
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
        )}

        {/* Section navigation tags */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {[
            { key: "classes" as const, label: "Classes", icon: CalendarDays, count: sortedClasses.length },
            ...(!isAdult ? [{ key: "camps" as const, label: "School Holiday & Weekend Events", icon: Music, count: camps.length }] : []),
            { key: "shows" as const, label: "Shows & Performances", icon: Ticket, count: shows.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => {
                setActiveSection(key);
                document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                activeSection === key
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* CLASSES SECTION */}
        <div id="section-classes" className={activeSection !== "classes" ? "hidden" : ""}>
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading classes...</div>
        ) : sortedClasses.length === 0 ? (
          <Card className="card-elevated border-border/50">
            <CardContent className="py-16 text-center text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              No {classType} classes available right now. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
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
                <Card
                  key={c.id}
                  className="card-elevated animate-fade-in rounded-xl overflow-hidden border-border/50 bg-card/80 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 group"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Workshop/venue photo header */}
                  {heroPhoto && (
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={heroPhoto}
                        alt={heroAlt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        style={workshopImage ? { objectPosition: (c.workshops as any)?.cover_position ?? "50% 50%" } : undefined}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      {/* Distance badge */}
                      {distance !== null && (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary/90 text-primary-foreground text-xs font-bold">
                            <Navigation className="w-3 h-3 mr-1" />
                            {distance < 1 ? `${(distance * 1760).toFixed(0)} yards` : `${distance.toFixed(1)} miles`}
                          </Badge>
                        </div>
                      )}
                      {hasGallery && galleryCount > 1 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" className="absolute bottom-2 right-2 text-xs gap-1 opacity-80 hover:opacity-100">
                              <Camera className="w-3 h-3" /> {galleryCount} photos
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogTitle className="text-lg font-bold">{photos?.name}</DialogTitle>
                            <div className="grid gap-4 mt-2">
                              {photos?.indoor && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Dance Space</p>
                                  <img src={photos.indoor} alt="Indoor dance space" className="rounded-lg w-full max-h-64 object-cover" />
                                </div>
                              )}
                              {photos?.outside && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Outside</p>
                                  <img src={photos.outside} alt="Outside view" className="rounded-lg w-full max-h-64 object-cover" />
                                </div>
                              )}
                              {photos?.parking && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider flex items-center gap-1"><Car className="w-3 h-3" /> Parking</p>
                                  <img src={photos.parking} alt="Parking area" className="rounded-lg w-full max-h-64 object-cover" />
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
                    <div className="px-4 pt-3 pb-0">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                        <Crown className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-primary">
                          {childNames.length === 1
                            ? `${childNames[0]} might love this!`
                            : `Great for ${childNames.slice(0, -1).join(", ")} & ${childNames[childNames.length - 1]}!`}
                        </span>
                      </div>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.dance_style && (
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs uppercase tracking-wider">{c.dance_style}</Badge>
                        )}
                        {c.invite_only && (
                          <Badge className="text-[10px] uppercase tracking-wider border bg-amber-500/15 text-amber-500 border-amber-500/30">
                            Invite Only
                          </Badge>
                        )}
                      </div>
                      {audienceText(c) && (
                        <span className="text-[11px] text-muted-foreground/80 whitespace-nowrap">{audienceText(c)}</span>
                      )}
                    </div>
                    <CardTitle className="text-xl font-bold tracking-wide group-hover:text-primary transition-colors">{c.name}</CardTitle>
                    {c.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>{c.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground mb-4" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" />
                        <span>{daysLabel}{dateRange && <span className="text-muted-foreground/70 ml-1">· {dateRange}</span>}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>{c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}</span>
                      </div>
                      {venue && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          <span>{venue.name}</span>
                        </div>
                      )}
                      {staff && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>{instructorFirstName(staff.full_name)} <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 ml-1">Instructor</span></span>
                        </div>
                      )}
                    </div>

                    {/* Invite-only sessions are visible but never open-enrolment bookable */}
                    {c.invite_only && (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>This is an invite-only session. Places are offered directly by The Dance Exclusive team — please contact us if you think this crew is for you.</span>
                      </div>
                    )}

                    {/* Action buttons: Book Now (primary) + More Info (secondary) */}
                    <div className="flex items-stretch gap-2 mb-4">
                      {isClassBookable(c) ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!user) { navigate("/auth"); return; }
                            setQuickBookClassId(c.id);
                          }}
                          className="flex-1 uppercase tracking-wider text-xs font-bold gap-1.5 text-white hover:text-white hover:opacity-90"
                          style={{
                            background: isAdult ? "hsl(330, 90%, 55%)" : "hsl(193, 100%, 44%)",
                            boxShadow: isAdult
                              ? "0 4px 14px hsl(330, 90%, 55%, 0.25)"
                              : "0 4px 14px hsl(193, 100%, 44%, 0.25)",
                          }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Book Now
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled
                          className="flex-1 uppercase tracking-wider text-xs font-bold gap-1.5"
                          variant="secondary"
                        >
                          {c.invite_only ? "Invite Only" : "Booking Opening Soon"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 border-border/50 text-muted-foreground hover:text-primary"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <Info className="w-3.5 h-3.5" />
                        {isExpanded ? "Less Info" : "More Info"}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="space-y-5 pb-4 animate-fade-in border-t border-border/50 pt-4">
                        {/* Instructor section */}
                        {staff && (
                          <div className="flex gap-4">
                            {staffPhoto ? (
                              <img
                                src={staffPhoto}
                                alt={instructorFirstName(staff.full_name) ?? "Instructor"}
                                className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/30 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-primary/60" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{instructorFirstName(staff.full_name)}</p>
                              <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Instructor</p>
                              {staff.description && (
                                <p className="text-xs text-muted-foreground line-clamp-3" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                                  {staff.description}
                                </p>
                              )}
                              {staff.dance_skills?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {staff.dance_skills.slice(0, 5).map(s => (
                                    <Badge key={s} variant="outline" className="text-[10px] py-0 border-primary/20">{s}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Workshop description */}
                        {workshop?.description && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-1 font-medium">About This Class</p>
                            <p className="text-sm text-muted-foreground" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                              {workshop.description}
                            </p>
                          </div>
                        )}

                        {/* Venue details */}
                        {venue && (
                          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                            <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Venue
                            </p>
                            <p className="font-semibold text-foreground text-sm">{venue.name}</p>
                            <p className="text-xs text-muted-foreground" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                              {venue.address_line1}
                              {venue.address_line2 && `, ${venue.address_line2}`}
                              {`, ${venue.city}`}
                              {`, ${venue.postcode}`}
                            </p>
                            {venue.directions && (
                              <p className="text-xs text-muted-foreground" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                                <span className="font-medium text-foreground">Directions: </span>{venue.directions}
                              </p>
                            )}
                            {venue.drop_off_info && (
                              <p className="text-xs text-muted-foreground" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                                <span className="font-medium text-foreground">Drop-off: </span>{venue.drop_off_info}
                              </p>
                            )}
                            {venue.has_parking && venue.parking_details && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                                <Car className="w-3 h-3 text-primary" />
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
                                  className="w-full mt-2 text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                >
                                  <Navigation className="w-3.5 h-3.5" />
                                  Get Driving Directions
                                </Button>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Pricing plan selector */}
                        {(() => {
                          const remaining = sessionCounts[c.id] || 0;
                          const isChildrenClass = c.class_type === "children";
                          const plan = selectedPlans[c.id] || (isChildrenClass ? "monthly" : "session");
                          // Prices from the shared pricing engine (admin-set
                          // values win, otherwise derived from class duration).
                          const priceSess = sessionPrice(c);
                          const priceMon = monthlyPrice(c);
                          const priceYr = yearlyPrice(c);
                          const priceTrm = termPrice(c, remaining);
                          const termSavings = termlySavingsPercent();
                          const yearlySavings = yearlySavingsPercent();
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
                            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                              <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-medium flex items-center gap-1">
                                <Tag className="w-3 h-3" /> Choose Your Plan
                              </p>
                              {remaining > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  {remaining} session{remaining !== 1 ? "s" : ""} remaining this term
                                </p>
                              )}
                              <div className="grid gap-2">
                                {/* Adults: pay as you go */}
                                {!isChildrenClass && (
                                  <button
                                    onClick={() => { setSelectedPlans(p => ({ ...p, [c.id]: "session" })); setSelectedSessions(p => ({ ...p, [c.id]: [] })); }}
                                    className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${
                                      plan === "session"
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                        : "border-border/50 bg-background/50 hover:border-border"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-semibold text-foreground">Pay As You Go</span>
                                      <span className="block text-[10px] text-muted-foreground">Pick the dates · non-refundable, moveable up to 24h before</span>
                                    </div>
                                    <span className="font-bold text-foreground">£{priceSess}<span className="text-[10px] font-normal text-muted-foreground">/class</span></span>
                                  </button>
                                )}

                                {/* Children: monthly membership */}
                                {isChildrenClass && (
                                  <button
                                    onClick={() => { setSelectedPlans(p => ({ ...p, [c.id]: "monthly" })); setSelectedSessions(p => ({ ...p, [c.id]: sessions.map(s => s.id) })); }}
                                    className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${
                                      plan === "monthly"
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                        : "border-border/50 bg-background/50 hover:border-border"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-semibold text-foreground">Monthly Membership</span>
                                      <span className="block text-[10px] text-muted-foreground">Rolling monthly · paused in August · 1 month's notice</span>
                                    </div>
                                    <span className="font-bold text-foreground">
                                      £{priceMon.toFixed(2)}
                                      <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                                    </span>
                                  </button>
                                )}

                                {/* Children: pay termly */}
                                {isChildrenClass && priceTrm != null && remaining > 0 && (
                                  <button
                                    onClick={() => selectAllSessions()}
                                    className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${
                                      plan === "term"
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                        : "border-border/50 bg-background/50 hover:border-border"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-semibold text-foreground">Pay Termly</span>
                                      <span className="block text-[10px] text-muted-foreground">All {remaining} sessions this term, upfront</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-foreground">£{priceTrm.toFixed(2)}</span>
                                      <Badge className="ml-1.5 bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">
                                        SAVE {termSavings}%
                                      </Badge>
                                    </div>
                                  </button>
                                )}

                                {/* Children: pay yearly — best deal */}
                                {isChildrenClass && (
                                  <button
                                    onClick={() => { setSelectedPlans(p => ({ ...p, [c.id]: "yearly" })); setSelectedSessions(p => ({ ...p, [c.id]: sessions.map(s => s.id) })); }}
                                    className={`relative flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${
                                      plan === "yearly"
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                        : "border-border/50 bg-background/50 hover:border-border"
                                    }`}
                                  >
                                    <div className="absolute -top-2 right-2">
                                      <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0">BEST DEAL</Badge>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-foreground">Pay Yearly</span>
                                      <span className="block text-[10px] text-muted-foreground">Sept–July upfront · all 38 dance weeks</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-foreground">£{priceYr.toFixed(2)}</span>
                                      <Badge className="ml-1.5 bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">
                                        SAVE {yearlySavings}%
                                      </Badge>
                                    </div>
                                  </button>
                                )}
                              </div>

                              {/* Session date picker — for drop-in */}
                              {plan === "session" && sessions.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-border/30">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[11px] text-muted-foreground font-medium">Select sessions to attend:</p>
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
                                  <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                                    {sessions.map(s => {
                                      const isSelected = selSessions.includes(s.id);
                                      return (
                                        <label
                                          key={s.id}
                                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                                            isSelected
                                              ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                              : "border-border/50 bg-background/50 hover:border-border"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSession(s.id)}
                                            className="rounded border-border accent-primary w-4 h-4"
                                          />
                                          <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                          <span className="flex-1 text-foreground font-medium">
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
                                    <p className="text-[11px] text-primary font-medium">
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
                                  <div className="space-y-1.5 pt-2 border-t border-border/30">
                                    <p className="text-[11px] text-muted-foreground font-medium">Select children to add:</p>
                                    {!hasEligible && (
                                      <p className="text-[11px] text-amber-500">
                                        None of your children are in the age range{c.age_min != null && c.age_max != null ? ` (ages ${c.age_min}–${c.age_max})` : ""}.
                                      </p>
                                    )}
                                    {eligibleChildren.map(ch => (
                                      <label
                                        key={ch.id}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                                          !ch.eligible
                                            ? "opacity-40 cursor-not-allowed border-border/30 bg-muted/20"
                                            : ch.alreadyAdded
                                              ? "opacity-60 cursor-not-allowed border-green-500/30 bg-green-500/5"
                                              : selected.includes(ch.id)
                                                ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                                                : "border-border/50 bg-background/50 hover:border-border"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selected.includes(ch.id) || ch.alreadyAdded}
                                          disabled={!ch.eligible || ch.alreadyAdded}
                                          onChange={() => toggleChild(ch.id)}
                                          className="rounded border-border accent-primary w-4 h-4"
                                        />
                                        <span className="flex-1 text-foreground font-medium">
                                          {ch.first_name} {ch.last_name}
                                          <span className="text-muted-foreground font-normal ml-1">(age {ch.age})</span>
                                        </span>
                                        {!ch.eligible && <span className="text-[10px] text-amber-500">not in age group</span>}
                                        {ch.alreadyAdded && <span className="text-[10px] text-green-400">in basket</span>}
                                      </label>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* No children yet — prompt to add one */}
                              {c.class_type === "children" && user && children.length === 0 && (
                                <div className="pt-2 border-t border-border/30">
                                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm space-y-2">
                                    <p style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                                      Add your child's details to book them into this class.
                                    </p>
                                    <Button size="sm" onClick={() => setAddChildOpen(true)} className="gap-1.5">
                                      <UserPlus className="w-3.5 h-3.5" /> Add a Child
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Add to basket inside the plan area */}
                              {(() => {
                                const sessionsSelected = selSessions.length;
                                const price = plan === "term" ? priceTrm
                                  : plan === "monthly" ? priceMon
                                  : plan === "yearly" ? priceYr
                                  : priceSess;
                                const selectedKids = selectedChildren[c.id] || [];
                                const allSelectedInCart = c.class_type === "children" && selectedKids.length > 0
                                  && selectedKids.every(sid => cartItems.some(ci => ci.classId === c.id && ci.studentId === sid));
                                // Must pick at least one attendee for a children's class.
                                const noKidsSelected = c.class_type === "children" && selectedKids.length === 0;
                                const noSessionsSelected = plan === "session" && sessionsSelected === 0;

                                const totalForDropIn = plan === "session" ? priceSess * sessionsSelected : price;
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
                                    unitPrice: plan === "session" ? priceSess : (price || 0),
                                    totalPrice: plan === "session" ? priceSess * sessionsSelected : (price || 0),
                                    sessionsCount: plan === "term" ? remaining : plan === "session" ? sessionsSelected : null,
                                    termDiscountPercent: plan === "term" ? termSavings : null,
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
                                  : plan === "yearly" ? "year"
                                  : sessionsSelected > 1 ? `${sessionsSelected} sessions` : "session";

                                return (
                                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                                    <div style={{ textTransform: 'none', fontFamily: 'var(--font-body)' }}>
                                      {displayPrice ? (
                                        <span className="text-lg font-bold text-foreground">
                                          £{displayPrice.toFixed(2).replace(/\.00$/, '')}
                                          <span className="text-xs font-normal text-muted-foreground ml-0.5">/{priceLabel}</span>
                                          {(c.class_type === "children" ? selectedKids.length : 0) > 1 && (
                                            <span className="text-xs font-normal text-muted-foreground ml-1">× {selectedKids.length} children</span>
                                          )}
                                        </span>
                                      ) : null}
                                    </div>
                                    <Button
                                      size="sm"
                                      disabled={!isClassBookable(c) || allSelectedInCart || noKidsSelected || noSessionsSelected}
                                      onClick={() => {
                                        // Monthly membership requires an explicit
                                        // cancellation-notice acknowledgement first.
                                        if (plan === "monthly") setMonthlyNotice({ proceed: handleAddToCart });
                                        else handleAddToCart();
                                      }}
                                      className="uppercase tracking-wider text-xs font-semibold gap-1.5"
                                      style={{
                                        background: allSelectedInCart ? undefined : isAdult ? "hsl(330, 90%, 55%)" : "hsl(193, 100%, 44%)",
                                        color: allSelectedInCart ? undefined : "white",
                                      }}
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      {allSelectedInCart ? "In Basket"
                                        : noSessionsSelected ? "Select sessions"
                                        : selectedKids.length > 1 ? `Add ${selectedKids.length} to Basket`
                                        : "Add to Basket"}
                                    </Button>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>

        {/* CAMPS SECTION — children only */}
        {!isAdult && <div id="section-camps" className={activeSection !== "camps" ? "hidden" : ""}>
          {camps.length === 0 ? (
            <Card className="card-elevated border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Music className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                No upcoming camps right now. Check back soon!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {[...camps].sort((a: any, b: any) => {
                const aMatch = getMatchingChildren(a).length > 0 ? 0 : 1;
                const bMatch = getMatchingChildren(b).length > 0 ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
                if (!effectiveCoords) return 0;
                const aDist = a.venues?.latitude && a.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, a.venues.latitude, a.venues.longitude) : 9999;
                const bDist = b.venues?.latitude && b.venues?.longitude ? haversineDistance(effectiveCoords.lat, effectiveCoords.lon, b.venues.latitude, b.venues.longitude) : 9999;
                return aDist - bDist;
              }).map((camp: any) => {
                const workshopImage = getWorkshopImageUrl(camp.workshops?.cover_image);
                const venue = camp.venues;
                const campMatchedChildren = getMatchingChildren(camp);
                const campChildNames = campMatchedChildren.map((ch: any) => ch.preferred_name || ch.first_name);
                return (
                  <Card key={camp.id} className="card-elevated rounded-xl overflow-hidden border-border/50 bg-card/80 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300">
                    {workshopImage && (
                      <div className="relative h-44 overflow-hidden">
                        <img src={workshopImage} alt={camp.name} className="w-full h-full object-cover" style={{ objectPosition: camp.workshops?.cover_position ?? "50% 50%" }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                        <Badge className="absolute top-3 left-3 bg-amber-500/90 text-white">
                          <Music className="w-3 h-3 mr-1" /> Event
                        </Badge>
                      </div>
                    )}
                    {campChildNames.length > 0 && (
                      <div className="px-4 pt-3 pb-0">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {campChildNames.length === 1
                              ? `Perfect for ${campChildNames[0]}!`
                              : `Great for ${campChildNames.slice(0, -1).join(", ")} & ${campChildNames[campChildNames.length - 1]}!`}
                          </span>
                        </div>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-bold tracking-wide">{camp.name}</CardTitle>
                      {camp.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>{camp.description}</p>}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                        {camp.start_date && camp.end_date && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                            <span>{format(parseISO(camp.start_date), "d MMM")} – {format(parseISO(camp.end_date), "d MMM yyyy")}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{camp.start_time?.slice(0, 5)} – {camp.end_time?.slice(0, 5)}</span>
                        </div>
                        {venue && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            <span>{venue.name}</span>
                          </div>
                        )}
                        {camp.age_min != null && camp.age_max != null && (
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            <span>Ages {camp.age_min}–{camp.age_max}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div>
                          {camp.price_per_day && <span className="text-lg font-bold text-foreground">£{camp.price_per_day}<span className="text-xs font-normal text-muted-foreground">/day</span></span>}
                          {camp.price_total && !camp.price_per_day && <span className="text-lg font-bold text-foreground">£{camp.price_total}<span className="text-xs font-normal text-muted-foreground"> total</span></span>}
                        </div>
                        <Button
                          size="sm"
                          className="uppercase tracking-wider text-xs font-semibold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => {
                            if (!user) { navigate("/auth"); return; }
                            setBookCampId(camp.id);
                          }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Book Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>}

        {/* SHOWS SECTION */}
        <div id="section-shows" className={activeSection !== "shows" ? "hidden" : ""}>
          {shows.length === 0 ? (
            <Card className="card-elevated border-border/50">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Ticket className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                No upcoming shows right now. Check back soon!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {shows.map((show: any) => {
                const venue = show.venues;
                return (
                  <Card key={show.id} className="card-elevated rounded-xl overflow-hidden border-border/50 bg-card/80 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300">
                    {show.cover_image && (
                      <div className="relative h-44 overflow-hidden">
                        <img src={show.cover_image} alt={show.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">
                          <Crown className="w-3 h-3 mr-0.5" /> SHOW
                        </Badge>
                        {show.dance_style && (
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs">{show.dance_style}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl font-bold tracking-wide">{show.name}</CardTitle>
                      {show.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>{show.description}</p>}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4" style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)' }}>
                        {show.show_date && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-purple-400" />
                            <span>{format(parseISO(show.show_date), "EEEE d MMMM yyyy")}</span>
                          </div>
                        )}
                        {show.show_time && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            <span>Doors {show.show_time.slice(0, 5)}{show.duration_minutes ? ` · ${show.duration_minutes} mins` : ""}</span>
                          </div>
                        )}
                        {venue && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            <span>{venue.name}, {venue.city}</span>
                          </div>
                        )}
                        {show.capacity && (
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-purple-400" />
                            <span>{show.capacity - (show.tickets_sold || 0)} tickets remaining</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div>
                          {show.ticket_price ? (
                            <span className="text-lg font-bold text-foreground">£{show.ticket_price}<span className="text-xs font-normal text-muted-foreground">/ticket</span></span>
                          ) : (
                            <span className="text-lg font-bold text-green-400">FREE</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="uppercase tracking-wider text-xs font-semibold gap-1.5 bg-purple-500 hover:bg-purple-600 text-white"
                          onClick={() => { if (!user) navigate("/auth"); }}
                        >
                          <Ticket className="w-3.5 h-3.5" /> Get Tickets
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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

      {/* Book a holiday workshop (camp) — priced per drop-in day */}
      <CampBookDialog
        open={!!bookCampId}
        onOpenChange={(o) => { if (!o) setBookCampId(null); }}
        camp={bookCampId ? (camps.find((cp: any) => cp.id === bookCampId) as any) : null}
        children={children}
        onNeedChild={(child) => {
          if (child) setProfileNudge(child);
          else setAddChildOpen(true);
        }}
      />

      {/* Monthly membership cancellation notice — acknowledged before basket add */}
      <AlertDialog open={!!monthlyNotice} onOpenChange={(o) => { if (!o) setMonthlyNotice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Monthly Membership</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">{MONTHLY_MEMBERSHIP_NOTICE}</span>
              <span className="block text-xs">{MONTHLY_PAYMENT_INFO}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const proceed = monthlyNotice?.proceed;
                setMonthlyNotice(null);
                proceed?.();
              }}
            >
              I agree — add to basket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClassBrowser;
