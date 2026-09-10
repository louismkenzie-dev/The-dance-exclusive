import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvitedPlans, trialGateFor } from "@/hooks/useInvitedPlans";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AvailabilityPill,
  BlockSkeleton,
  Bone,
  EmptyState,
  SectionHeading,
  StickyActionBar,
  StickyActionBarSpacer,
  SummarySkeleton,
  TextSkeleton,
} from "@/components/booking";
import { QuickBookDialog } from "@/components/portal/QuickBookDialog";
import WorkshopCover from "@/components/WorkshopCover";
import { TermSessionGroups } from "@/components/TermSessionGroups";
import { audienceText } from "@/lib/classAudience";
import { availabilityFor, formatTimeRange, initialsFor } from "@/lib/bookingFormat";
import {
  classCardState,
  classDaysLabel,
  classPlanRows,
  classPriceSummary,
  instructorFirstName,
  isClassFull,
} from "@/lib/classPresentation";

/**
 * /book/:classId — one class as a page: when, where, who teaches it, the
 * dates this term and what it costs. Booking itself happens in the same
 * sheet the class browser opens, so every rule lives in one place.
 */

const getWorkshopImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
  return data?.publicUrl || null;
};

const getStaffPhotoUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
  return data?.publicUrl || null;
};

interface VenueData {
  name: string;
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
  dance_skills: string[] | null;
}

interface ClassDetail {
  id: string;
  name: string;
  description: string | null;
  class_type: "children" | "adult";
  dance_style: string | null;
  age_min: number | null;
  age_max: number | null;
  school_year_min: number | null;
  school_year_max: number | null;
  audience_label: string | null;
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
  term_end: string | null;
  allow_trial: boolean;
  allow_monthly: boolean | null;
  allow_termly: boolean | null;
  allow_yearly: boolean | null;
  invite_only: boolean;
  booking_enabled: boolean;
  status: string;
  publicly_visible: boolean;
  is_active: boolean;
  instructor_id: string | null;
  venues: VenueData | null;
  staff: StaffData | null;
  workshops: { cover_image: string | null; cover_position: string | null; cover_zoom: number | null; cover_fit: string | null; name: string; description: string | null } | null;
}

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

interface ChildRow {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  expected_arrival_time?: string | null;
  expected_departure_time?: string | null;
}

interface StaffPublicRow {
  id: string;
  first_name: string;
  profile_photo: string | null;
  description: string | null;
  dance_skills: string[] | null;
}

interface EnrolmentRow {
  class_id: string;
  confirmed_count: number | string;
}

const CLASS_SELECT = `*,
  venues(name, photo_outside, photo_indoor, photo_parking, address_line1, address_line2, city, postcode, latitude, longitude, directions, drop_off_info, has_parking, parking_details),
  workshops(cover_image, cover_position, cover_zoom, cover_fit, name, description)`;

const INITIAL_DATES = 8;

const INVITE_ONLY_NOTE =
  "This is an invite-only session. Places are offered directly by The Dance Exclusive team — please contact us if you think this crew is for you.";

const BookClass = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [enrolled, setEnrolled] = useState<number | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [selfStudent, setSelfStudent] = useState<ChildRow | null>(null);
  const [hasExistingBookings, setHasExistingBookings] = useState<boolean | null>(null);
  const invitedPlans = useInvitedPlans();
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  // The class itself, its instructor, this term's dates and how full it is —
  // the same selects the class browser makes, for one id.
  useEffect(() => {
    let cancelled = false;
    if (!classId) { setStatus("missing"); return; }
    setStatus("loading");
    setShowAllDates(false);
    (async () => {
      try {
        const { data: raw, error } = await supabase
          .from("classes")
          .select(CLASS_SELECT)
          .eq("id", classId)
          .eq("is_active", true)
          .eq("publicly_visible", true)
          .eq("status", "confirmed")
          .maybeSingle();
        if (error) {
          // A link that isn't even a class id reads as "not available"
          // rather than a failure.
          if (error.code === "22P02") { if (!cancelled) setStatus("missing"); return; }
          throw error;
        }
        if (!raw) { if (!cancelled) setStatus("missing"); return; }
        const c = raw as unknown as ClassDetail;

        let staff: StaffData | null = null;
        if (c.instructor_id) {
          // The public-safe staff view isn't in the generated types.
          const { data: staffRows } = await (supabase.from("staff_public" as any) as any)
            .select("id, first_name, profile_photo, description, dance_skills")
            .in("id", [c.instructor_id]);
          const s = ((staffRows as StaffPublicRow[] | null) ?? [])[0];
          if (s) staff = { full_name: s.first_name, profile_photo: s.profile_photo, description: s.description, dance_skills: s.dance_skills };
        }

        const today = new Date().toISOString().split("T")[0];
        const { data: sessionData } = await supabase
          .from("class_sessions")
          .select("id, class_id, session_date, start_time, end_time")
          .in("class_id", [c.id])
          .eq("status", "scheduled")
          .order("session_date");
        const all = (sessionData ?? []) as SessionRow[];
        const upcoming = all.filter((s) => s.session_date >= today);
        // Same rule as the browser: a class with no dates left (or whose
        // term has ended) is finished, unless its dates simply aren't
        // generated yet.
        const termEnded = !!c.term_end && c.term_end < today;
        if (upcoming.length === 0 && (all.length > 0 || termEnded)) {
          if (!cancelled) setStatus("missing");
          return;
        }

        const { data: enrolData } = await (supabase.rpc as any)("get_class_enrollment", { _class_ids: [c.id] });
        const row = ((enrolData as EnrolmentRow[] | null) ?? []).find((r) => r.class_id === c.id);
        const count = row ? Number(row.confirmed_count) : 0;

        if (cancelled) return;
        setCls({ ...c, staff });
        setSessions(upcoming);
        setEnrolled(count);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [classId, reloadKey]);

  // Attendee profiles for signed-in families: children for children's
  // classes, plus the adult's own self profile (required to book adult classes).
  const fetchAttendees = () => {
    if (!user) return;
    supabase.from("students")
      .select("*")
      .eq("parent_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setChildren(data.filter((s) => !s.is_self));
        setSelfStudent(data.find((s) => s.is_self) ?? null);
      });
  };
  useEffect(fetchAttendees, [user]);

  // Any existing bookings? (Trial eligibility.)
  useEffect(() => {
    if (!user) { setHasExistingBookings(null); return; }
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("parent_id", user.id)
      .eq("status", "confirmed")
      .then(({ count }) => {
        setHasExistingBookings((count ?? 0) > 0);
      });
  }, [user]);

  // Already waitlisted for this class?
  useEffect(() => {
    if (!user || !classId) { setOnWaitlist(false); return; }
    (supabase.from("class_waitlist" as any) as any)
      .select("class_id")
      .eq("parent_id", user.id)
      .eq("class_id", classId)
      .then(({ data }: { data: unknown[] | null }) => {
        if (data) setOnWaitlist(data.length > 0);
      });
  }, [user, classId]);

  const toggleWaitlist = async () => {
    if (!cls) return;
    if (!user) { navigate("/auth"); return; }
    setWaitlistBusy(true);
    const table = supabase.from("class_waitlist" as any) as any;
    if (onWaitlist) {
      const { error } = await table.delete().eq("class_id", cls.id).eq("parent_id", user.id);
      if (error) {
        toast.error("Couldn't leave the waitlist — please try again.");
      } else {
        setOnWaitlist(false);
        toast.success("Removed from waitlist", { description: cls.name });
      }
    } else {
      const { error } = await table.insert({ class_id: cls.id, parent_id: user.id });
      if (error) {
        toast.error("Couldn't join the waitlist — please try again.");
      } else {
        setOnWaitlist(true);
        toast.success("You're on the waitlist!", {
          description: `We'll email you as soon as a space opens up in ${cls.name}.`,
        });
      }
    }
    setWaitlistBusy(false);
  };

  if (status === "loading") {
    return (
      <div className="container py-6 sm:py-10">
        <Bone className="h-4 w-36" />
        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12">
          <div className="min-w-0 lg:max-w-2xl">
            <Bone className="-mx-4 aspect-[16/9] rounded-none sm:mx-0 sm:rounded-2xl" />
            <Bone className="mt-6 h-3 w-40" />
            <Bone className="mt-3 h-8 w-2/3" />
            <TextSkeleton lines={3} className="mt-5" />
            <BlockSkeleton className="mt-10" />
            <BlockSkeleton className="mt-6" />
          </div>
          <div className="hidden lg:block">
            <SummarySkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-10">
        <EmptyState
          tone="error"
          title="Something went wrong"
          body="We couldn't load this class. Please try again."
          action={
            <Button variant="soft" className="h-11 rounded-full px-5" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "missing" || !cls) {
    return (
      <div className="container py-10">
        <EmptyState
          title="This class isn't available"
          body="It may have finished, or the link is out of date."
          action={
            <Button variant="soft" className="h-11 rounded-full px-5" asChild>
              <Link to="/classes/children">Browse classes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isAdult = cls.class_type === "adult";
  const venue = cls.venues;
  const staff = cls.staff;
  const cover = getWorkshopImageUrl(cls.workshops?.cover_image);
  const staffPhoto = getStaffPhotoUrl(staff?.profile_photo);
  const instructor = instructorFirstName(staff?.full_name);
  const availability = availabilityFor(cls.capacity, enrolled);
  const full = isClassFull(cls.capacity, enrolled);
  const state = classCardState(cls, full);
  const { priceLabel, priceHint } = classPriceSummary(cls, sessions.length);
  // A place the studio saved for this family unlocks the plan they
  // were offered, even one the public rules would hide.
  const plans = classPlanRows(cls, sessions.length, trialGateFor(invitedPlans, cls.id, hasExistingBookings));
  const about = cls.workshops?.description || cls.description;
  const eyebrow = [cls.dance_style, audienceText(cls)].filter(Boolean).join(" · ");
  const directionsUrl = venue?.latitude && venue?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
    : null;
  const visibleSessions = showAllDates ? sessions : sessions.slice(0, INITIAL_DATES);

  const ctaLabel = state === "full" ? (onWaitlist ? "Leave waitlist" : "Join waitlist")
    : state === "invite" ? "Invite only"
    : state === "soon" ? "Coming soon"
    : "Book";
  const ctaDisabled = waitlistBusy || state === "invite" || state === "soon";

  const onPrimary = () => {
    if (state === "full") { void toggleWaitlist(); return; }
    if (state !== "bookable") return;
    if (!user) { navigate(`/auth?redirect=${encodeURIComponent(pathname)}`); return; }
    setBookOpen(true);
  };

  const nextStepNote = state === "invite"
    ? INVITE_ONLY_NOTE
    : state === "soon"
      ? "Booking for this class isn't open yet."
      : state === "full"
        ? (onWaitlist ? "You're on the waitlist — we'll email you as soon as a space opens up." : "This class is fully booked. Join the waitlist and we'll email you when a space opens up.")
        : isAdult
          ? "You'll pick your dates next."
          : "You'll choose a plan and who's attending next.";
  // What the headline price is, in the sticky card.
  const priceCaption = isAdult
    ? "Pay as you go"
    : priceHint === "/month" ? "Monthly membership"
      : priceHint === "/term" ? "Pay for the term"
        : "Per class";
  const trialPlan = plans.find((p) => p.id === "trial");

  const ctaButton = (extraClass: string) => (
    <Button
      size="xl"
      variant={state === "bookable" ? "default" : "soft"}
      className={`rounded-full ${extraClass}`}
      disabled={ctaDisabled}
      onClick={onPrimary}
    >
      {waitlistBusy ? "…" : ctaLabel}
    </Button>
  );

  return (
    <div className="bg-background">
      <div className="container py-6 sm:py-10">
        <Link
          to={`/classes/${cls.class_type}`}
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All {isAdult ? "adult" : "children's"} classes
        </Link>

        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12 xl:gap-16">
          <div className="min-w-0 lg:max-w-2xl">
            {cover && (
              <div className="-mx-4 aspect-[16/9] overflow-hidden bg-muted sm:mx-0 sm:rounded-2xl">
                <WorkshopCover
                  src={cover}
                  alt=""
                  cover_position={cls.workshops?.cover_position}
                  cover_zoom={cls.workshops?.cover_zoom}
                  cover_fit={cls.workshops?.cover_fit}
                />
              </div>
            )}

            <div className={cover ? "mt-6" : "mt-2"}>
              <SectionHeading as="h1" size="page" eyebrow={eyebrow || undefined} title={cls.name} />
            </div>

            <ul className="mt-5 space-y-2 text-[15px] text-foreground/90">
              <li className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{classDaysLabel(cls.days_of_week, cls.day_of_week)} · {formatTimeRange(cls.start_time, cls.end_time)}</span>
              </li>
              {venue && (
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {venue.name}, {venue.city}
                    {directionsUrl && (
                      <>
                        <span aria-hidden> · </span>
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          Directions
                        </a>
                      </>
                    )}
                  </span>
                </li>
              )}
              {instructor && (
                <li className="flex items-center gap-3">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>with {instructor}</span>
                </li>
              )}
            </ul>

            <AvailabilityPill availability={availability} className="mt-4" />

            {/* Phones: the note that the desktop card carries */}
            {state !== "bookable" && (
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground lg:hidden">{nextStepNote}</p>
            )}

            {about && <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{about}</p>}

            {sessions.length > 0 && (
              <section className="mt-10" aria-label="This term">
                <SectionHeading
                  title="This term"
                  aside={<span className="text-[13px] text-muted-foreground">{sessions.length} {sessions.length === 1 ? "class" : "classes"}</span>}
                />
                <div className="surface mt-4 px-5 py-2">
                  <TermSessionGroups
                    sessions={visibleSessions}
                    dateOf={(s) => s.session_date}
                    className="space-y-2"
                    renderSession={(s) => (
                      <div key={s.id} className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-[15px] last:border-b-0">
                        <span className="text-foreground">{format(parseISO(s.session_date), "EEE d MMM")}</span>
                        <span className="tabular-nums text-muted-foreground">{formatTimeRange(s.start_time, s.end_time)}</span>
                      </div>
                    )}
                  />
                  {sessions.length > INITIAL_DATES && (
                    <button
                      type="button"
                      onClick={() => setShowAllDates((v) => !v)}
                      className="pressable my-2 inline-flex h-11 items-center rounded-full text-[15px] font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                    >
                      {showAllDates ? "Show fewer dates" : `Show all ${sessions.length} dates`}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Classes pause for half term and the school holidays.{" "}
                  <Link to="/term-dates" className="font-medium text-foreground underline-offset-4 hover:underline">Term dates</Link>
                </p>
              </section>
            )}

            {plans.length > 0 && (
              <section className="mt-10" aria-label="Plans">
                <SectionHeading
                  title="Plans"
                  subtitle={isAdult ? "Pay for the classes you come to." : "Choose how to pay when you book."}
                />
                <div className="surface mt-4 divide-y divide-border/60">
                  {plans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">{p.title}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{p.meta}</p>
                      </div>
                      <p className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground">
                        {p.price}
                        {p.priceSuffix && <span className="ml-1 text-[13px] font-normal text-muted-foreground">{p.priceSuffix}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {staff && instructor && (
              <section className="mt-10" aria-label="Instructor">
                <SectionHeading title="Your instructor" />
                <div className="surface mt-4 flex gap-4 p-5">
                  {staffPhoto ? (
                    <img src={staffPhoto} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-foreground" aria-hidden>
                      {initialsFor(instructor)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold tracking-tight text-foreground">{instructor}</p>
                    {staff.description && (
                      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{staff.description}</p>
                    )}
                    {staff.dance_skills && staff.dance_skills.length > 0 && (
                      <p className="mt-2 text-[13px] text-muted-foreground">{staff.dance_skills.slice(0, 5).join(" · ")}</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {venue && (
              <section className="mt-10" aria-label="Venue">
                <SectionHeading title="Getting there" />
                <div className="surface mt-4 space-y-3 p-5 text-[15px]">
                  <div>
                    <p className="font-semibold text-foreground">{venue.name}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {[venue.address_line1, venue.address_line2, venue.city, venue.postcode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  {venue.directions && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Directions · </span>{venue.directions}
                    </p>
                  )}
                  {venue.drop_off_info && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Drop-off · </span>{venue.drop_off_info}
                    </p>
                  )}
                  {venue.has_parking && venue.parking_details && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Parking · </span>{venue.parking_details}
                    </p>
                  )}
                  {directionsUrl && (
                    <Button variant="soft" className="h-11 rounded-full px-5" asChild>
                      <a href={directionsUrl} target="_blank" rel="noopener noreferrer">Get directions</a>
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Desktop: the price and the one action stay in view */}
          <aside className="hidden lg:block">
            <div className="surface sticky top-32 p-6">
              <p className="text-[13px] font-medium text-muted-foreground">{priceCaption}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {priceLabel}
                <span className="ml-1.5 text-[15px] font-normal tracking-normal text-muted-foreground">{priceHint}</span>
              </p>
              <AvailabilityPill availability={availability} className="mt-2" />
              {ctaButton("mt-5 w-full")}
              <p className="mt-3 text-center text-[13px] leading-relaxed text-muted-foreground">{nextStepNote}</p>
              {state === "bookable" && trialPlan && (
                <p className="mt-3 border-t border-border/60 pt-3 text-center text-[13px] leading-relaxed text-muted-foreground">
                  First time? A trial class is <span className="font-medium text-foreground">{trialPlan.price}</span>.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <StickyActionBarSpacer />
      {/* Sits above the app tab bar, which stays on this page. */}
      <StickyActionBar className="bottom-[calc(53px+env(safe-area-inset-bottom))] !pb-0" action={ctaButton("px-7")}>
        <p className="truncate text-[15px] font-semibold tabular-nums text-foreground">
          {priceLabel}
          <span className="ml-1 text-[13px] font-normal text-muted-foreground">{priceHint}</span>
        </p>
        <AvailabilityPill availability={availability} className="mt-0.5" />
      </StickyActionBar>

      <QuickBookDialog
        open={bookOpen}
        onOpenChange={(o) => { if (!o) setBookOpen(false); }}
        classData={bookOpen ? cls : null}
        sessions={sessions}
        children={children}
        hasExistingBookings={hasExistingBookings}
        isAdult={isAdult}
        selfStudent={selfStudent}
        onChildrenChanged={fetchAttendees}
      />
    </div>
  );
};

export default BookClass;
