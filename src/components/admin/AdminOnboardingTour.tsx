import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  MapPin,
  Rocket,
  Sparkles,
  Sun,
  Ticket,
  UserCog,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TourStep {
  icon: LucideIcon;
  title: string;
  description: string;
  highlights?: string[];
  /** Where "Take me there" navigates. Omitted on steps with nowhere to go. */
  route?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to The Dance Exclusive admin",
    description:
      "This is your control room for the whole school — classes, venues, bookings, students, staff and payments, all in one place. Everything you change here is live on your public site the moment you save, so parents always see the latest picture.",
    highlights: [
      "Changes go live instantly — there's no separate publish step",
      "Use the sidebar to jump between areas at any time",
      "This quick guide takes about two minutes",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Your dashboard",
    description:
      "Every time you sign in you'll land here: headline numbers for students, bookings and venues, the next seven days of sessions, and anything that needs your attention — like a DBS check or a venue contract coming up for renewal.",
    highlights: [
      "At-a-glance stats for classes, bookings and staff",
      "Upcoming sessions across the next 7 days",
      "“Attention needed” flags expiring documents and contracts",
    ],
    route: "/admin",
  },
  {
    icon: MapPin,
    title: "Venues",
    description:
      "Add each hall or studio you teach from — photos, address, the lot. Publish a venue to show it on your public site, and mark your favourites as featured to give them pride of place in the homepage carousel.",
    highlights: [
      "Photos and addresses parents can actually find",
      "Publish or hide each venue on the public site",
      "Featured venues appear in the homepage carousel",
    ],
    route: "/admin/venues",
  },
  {
    icon: Layers,
    title: "Type of Class templates",
    description:
      "Think of these as your recipe cards. Set up each type of class once — name, dance style, age range, duration and a cover image — and the class wizard builds real, bookable classes from them again and again.",
    highlights: [
      "One template can power classes at any venue or time",
      "Cover images make your public listings shine",
      "Tweak a template any time as your offering evolves",
    ],
    route: "/admin/workshops",
  },
  {
    icon: Wand2,
    title: "Creating classes",
    description:
      "The 5-step wizard does the heavy lifting: pick a template, schedule it against your term dates, review the sessions it generates, set your pricing, then assign staff. Pricing can be per-session, monthly, termly or yearly — and monthly and yearly can auto-suggest a figure from your session price.",
    highlights: [
      "“Sibling discount applies” gives an automatic 10% off for the second child onwards",
      "Add an optional WhatsApp group link — parents see it right after booking",
      "Sessions are generated for you from your term dates",
    ],
    route: "/admin/classes",
  },
  {
    icon: Sun,
    title: "Holiday workshops",
    description:
      "School holidays are covered too. Holiday camps and workshops are booked per day, so parents can pick exactly the days they need — and they're the only place your discount coupons ever apply.",
    highlights: [
      "Parents book individual days, not whole weeks",
      "Coupons apply here and nowhere else",
      "Perfect for taster days and holiday intensives",
    ],
    route: "/admin/camps",
  },
  {
    icon: CalendarRange,
    title: "Term dates",
    description:
      "Term dates are the backbone of your timetable. Set the start and end of each term and the class wizard generates every session — and your termly and yearly pricing — straight from them.",
    highlights: [
      "Class schedules are built from these dates",
      "Termly and yearly prices are calculated from them too",
      "Remember to confirm any provisional terms before you launch",
    ],
    route: "/admin/settings/term-dates",
  },
  {
    icon: Ticket,
    title: "Coupons",
    description:
      "Create discount codes for your holiday workshops — a percentage off or a fixed amount. Set usage limits and validity windows so an early-bird code quietly retires itself when the time's up.",
    highlights: [
      "Percentage or fixed-amount discounts",
      "Usage limits and start/end dates per code",
      "Coupons work on holiday workshops only — never term classes",
    ],
    route: "/admin/coupons",
  },
  {
    icon: Users,
    title: "Customers & students",
    description:
      "Every parent who signs up gets an account, and every child gets a profile underneath it — with medical notes, consent and emergency contacts. It's your single source of truth for exactly who's in the room.",
    highlights: [
      "Parent accounts with full contact details",
      "Children's profiles with medical and consent info",
      "Students have their own section in the sidebar too",
    ],
    route: "/admin/customers",
  },
  {
    icon: ClipboardCheck,
    title: "Bookings & registers",
    description:
      "Every paid booking lands here, so you always know who's coming and what's been paid. On class day, registers make check-in effortless: parents scan a QR code on arrival, with a family PIN as backup if a phone's been left at home.",
    highlights: [
      "Every booking with its payment status",
      "QR-code check-in at the door",
      "Family PIN backup — find registers in the sidebar",
    ],
    route: "/admin/bookings",
  },
  {
    icon: UserCog,
    title: "Your team",
    description:
      "Keep your teachers' profiles, DBS and first-aid documents, pay details and class assignments in one place. Invite each staff member to their own portal, where they can see their classes and take registers themselves.",
    highlights: [
      "DBS and first-aid documents with expiry reminders",
      "Pay details and class assignments per teacher",
      "Staff get their own portal login",
    ],
    route: "/admin/staff",
  },
  {
    icon: Rocket,
    title: "You're all set",
    description:
      "That's the tour! Here's the quickest route to going live:",
    highlights: [
      "Confirm your term dates",
      "Add your venues",
      "Create classes from your templates",
      "Enable booking on each class",
    ],
  },
];

const RESUME_STEP_KEY = "admin-tour-resume-step";
const OPEN_TOUR_EVENT = "admin-tour:open";

// Fetch the completion flag at most once per page session, even if the
// layout (and therefore this component) unmounts and remounts.
let hasCheckedTourFlag = false;

/** Opens the onboarding tour from anywhere in the admin area (e.g. the Dashboard's "Getting started" button). */
export const openAdminTour = () => {
  window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
};

/** Reads (and clears) the resume step saved by "Take me there". */
const readResumeStep = (): number | null => {
  const raw = sessionStorage.getItem(RESUME_STEP_KEY);
  if (raw === null) return null;
  sessionStorage.removeItem(RESUME_STEP_KEY);
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < TOUR_STEPS.length ? parsed : null;
};

const AdminOnboardingTour = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const openAtStep = useCallback((index: number) => {
    setDirection("forward");
    setStep(index);
    setOpen(true);
  }, []);

  // First sign-in: fetch the flag once per session and auto-open if the tour
  // has never been completed. The module-level guard stops route changes or
  // layout remounts from re-triggering the fetch (and the auto-open).
  useEffect(() => {
    if (!user?.id || hasCheckedTourFlag) return;
    hasCheckedTourFlag = true;

    let cancelled = false;
    supabase
      .from("profiles")
      .select("admin_tour_completed_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        if (data.admin_tour_completed_at === null) {
          openAtStep(readResumeStep() ?? 0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, openAtStep]);

  // Re-launch from the Dashboard's "Getting started" button. Resumes at the
  // step saved by "Take me there" if there is one, otherwise starts at step 1.
  useEffect(() => {
    const handleOpen = () => openAtStep(readResumeStep() ?? 0);
    window.addEventListener(OPEN_TOUR_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, handleOpen);
  }, [openAtStep]);

  // Completing or skipping stamps the flag. Failures are non-fatal.
  const markCompleted = useCallback(async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ admin_tour_completed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't save your tour progress — we'll show the guide again next time.");
    }
  }, [user?.id]);

  const closeAndComplete = () => {
    sessionStorage.removeItem(RESUME_STEP_KEY);
    setOpen(false);
    void markCompleted();
  };

  const goTo = (index: number) => {
    if (index === step || index < 0 || index >= TOUR_STEPS.length) return;
    setDirection(index > step ? "forward" : "back");
    setStep(index);
  };

  const handleTakeMeThere = (route: string) => {
    // Persist a resume point so reopening via "Getting started" picks up here,
    // then close the tour and navigate — a modal over a fresh page helps nobody.
    sessionStorage.setItem(RESUME_STEP_KEY, String(step));
    setOpen(false);
    navigate(route);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(step - 1);
    }
  };

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const StepIcon = current.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden border-primary/20 bg-card p-0 sm:p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Gradient header band */}
        <div className="relative h-20 shrink-0 border-b border-border/40 bg-gradient-to-r from-primary/25 via-primary/10 to-accent/15">
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl" aria-hidden="true" />
          <div className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-accent/15 blur-2xl" aria-hidden="true" />
        </div>

        {/* Step content — keyed so each step fades/slides in */}
        <div
          key={step}
          className={cn(
            "-mt-9 min-h-[19rem] px-6 pb-2 sm:px-8 animate-in fade-in-0 duration-300",
            direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4",
          )}
        >
          <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-primary/30 bg-primary/15 ring-4 ring-card">
            <StepIcon className="h-8 w-8 text-primary" />
          </div>

          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {step + 1} of {TOUR_STEPS.length}
          </p>

          <DialogTitle className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
            {current.title}
          </DialogTitle>

          <DialogDescription className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {current.description}
          </DialogDescription>

          {current.highlights && (
            <ul className="mt-4 space-y-2">
              {current.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2.5 text-sm text-foreground/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Check className="h-3 w-3 text-primary" />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
          )}

          {isLast && (
            <p className="mt-4 text-xs text-muted-foreground">
              You can reopen this guide any time from the Dashboard.
            </p>
          )}
        </div>

        {/* Progress dots — clickable */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          {TOUR_STEPS.map((tourStep, i) => (
            <button
              key={tourStep.title}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}: ${tourStep.title}`}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/25 hover:bg-primary/50",
              )}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/20 px-6 py-4 sm:px-8">
          {!isLast ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={closeAndComplete}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => goTo(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {current.route && (
              <Button variant="secondary" size="sm" onClick={() => handleTakeMeThere(current.route!)}>
                Take me there
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={closeAndComplete}>
                <Check className="h-4 w-4" /> Finish
              </Button>
            ) : (
              <Button size="sm" onClick={() => goTo(step + 1)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOnboardingTour;
