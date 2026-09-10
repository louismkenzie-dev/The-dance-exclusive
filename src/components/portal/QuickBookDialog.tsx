import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, type PricingPlan } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import { isChildAgeEligible } from "@/lib/classAudience";
import { defaultChildPlan, offersMonthly, offersTermly, offersYearly } from "@/lib/classPlans";
import { formatDay, formatPrice, formatTimeRange, initialsFor } from "@/lib/bookingFormat";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import { ResponsiveSheet, PlanPicker, AttendeePicker, type PlanOption, type AttendeeOption } from "@/components/booking";
import { BookingSection } from "@/components/booking/BookingSection";
import { BookingSheetFooter } from "@/components/booking/BookingSheetFooter";
import { BookingPromptCard } from "@/components/booking/BookingPromptCard";
import { MonthlyNoticeDialog } from "@/components/booking/MonthlyNoticeDialog";
import { SessionDatePicker } from "@/components/booking/SessionDatePicker";
import {
  MONTHLY_PAYMENT_INFO,
  UNLIMITED_CAP_INFO,
  monthlyPrice,
  sessionPrice,
  termPrice,
  termlySavingsPercent,
  trialPrice,
  yearlyPrice,
  yearlySavingsPercent,
} from "@/lib/pricing";

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

export interface QuickBookClass {
  id: string;
  name: string;
  class_type: "children" | "adult";
  dance_style: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  age_min: number | null;
  age_max: number | null;
  price_per_session: number | null;
  price_per_term: number | null;
  price_per_month: number | null;
  price_per_year: number | null;
  term_discount_percent: number | null;
  monthly_discount_percent: number | null;
  allow_trial: boolean;
  /** Which plans this class offers (admin switches; default all on). */
  allow_monthly?: boolean | null;
  allow_termly?: boolean | null;
  allow_yearly?: boolean | null;
  venues: { name: string } | null;
  workshops: { cover_image: string | null } | null;
}

interface QuickBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: QuickBookClass | null;
  sessions: SessionRow[];
  children: ChildRow[];
  hasExistingBookings: boolean | null;
  /** Open on this plan — the one the parent tapped in the class's price list. */
  presetPlan?: PricingPlan;
  isAdult: boolean;
  /** The account holder's own attendee profile (students.is_self) — required to book adult classes. */
  selfStudent?: ChildRow | null;
  /** Refetch the parent's attendee profiles after one is added/edited in this dialog. */
  onChildrenChanged?: () => void;
}

const getWorkshopImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("workshop-media").getPublicUrl(path);
  return data?.publicUrl || null;
};

const getAge = (dob: string) => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const joinNotes = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

/**
 * The booking sheet: a bottom sheet on a phone, a dialog on a desktop. Plan,
 * who is attending, dates (for pay-as-you-go and trials), then one action.
 */
export function QuickBookDialog({
  open,
  onOpenChange,
  classData,
  sessions,
  children,
  hasExistingBookings,
  presetPlan,
  isAdult,
  selfStudent = null,
  onChildrenChanged,
}: QuickBookDialogProps) {
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PricingPlan>("session");
  const [selSessions, setSelSessions] = useState<string[]>([]);
  const [selKids, setSelKids] = useState<string[]>([]);
  // Monthly memberships require an explicit cancellation-notice acknowledgement.
  const [monthlyNoticeOpen, setMonthlyNoticeOpen] = useState(false);
  // Add / complete an attendee profile without leaving the booking dialog.
  const [childDialog, setChildDialog] = useState<{ editing: any | null; selfMode: boolean } | null>(null);
  // The footer names the next thing to do ("Select dates"). Those live further
  // down the sheet, past the plans and the children, so on a phone they are
  // below the fold — the button has to be able to take you to them.
  const attendeesRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  // Reset selections when class changes / dialog opens.
  // Children: trial → the class's first offered plan (no drop-ins).
  // Adults: pay as you go.
  useEffect(() => {
    if (open && classData) {
      setSelSessions([]);
      setSelKids([]);
      // A plan the parent chose on the class page wins — they have already
      // said what they want, and re-deciding it for them is how someone ends
      // up looking at a plan they didn't ask for.
      if (presetPlan) {
        setPlan(presetPlan);
      } else if (classData.class_type === "adult") {
        setPlan("session");
      } else if (classData.allow_trial && hasExistingBookings === false) {
        setPlan("trial");
      } else {
        setPlan(defaultChildPlan(classData, sessions.length > 0));
      }
    }
  }, [open, classData, hasExistingBookings, presetPlan, sessions.length]);

  // Auto-select sessions for whole-plan purchases (must run before any early return)
  useEffect(() => {
    if (!open || !classData) return;
    if (plan === "term" || plan === "monthly" || plan === "yearly") {
      setSelSessions(sessions.map(s => s.id));
    } else if (plan === "session" || plan === "trial") {
      setSelSessions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, open, classData?.id]);

  if (!classData) return null;
  const c = classData;

  const remaining = sessions.length;
  const isChildren = c.class_type === "children";
  const isTrialEligible = c.allow_trial && hasExistingBookings === false;
  // Prices from the shared pricing engine (admin-set values win, otherwise
  // derived from the class duration per the published price list).
  const priceSession = sessionPrice(c);
  const priceTrial = trialPrice(c);
  const priceMonthly = monthlyPrice(c);
  const priceYearly = yearlyPrice(c);
  const priceTerm = termPrice(c, remaining);
  const termSavings = termlySavingsPercent();
  const yearlySavings = yearlySavingsPercent();

  const isPickPlan = plan === "session" || plan === "trial";

  // For each child, the set of session IDs already in their basket for this class (drop-in/trial only)
  const childSessionsInBasket = (childId: string): Set<string> => {
    const ids = cartItems
      .filter(ci => ci.classId === c.id && ci.studentId === childId && (ci.pricingPlan === "session" || ci.pricingPlan === "trial"))
      .flatMap(ci => ci.selectedSessionIds ?? []);
    return new Set(ids);
  };

  // Adult class: sessions already in basket for the account holder (self
  // profile, or legacy items with no studentId).
  const adultSessionsInBasket = (): Set<string> => {
    const ids = cartItems
      .filter(ci => ci.classId === c.id && (!ci.studentId || ci.studentId === selfStudent?.id) && (ci.pricingPlan === "session" || ci.pricingPlan === "trial"))
      .flatMap(ci => ci.selectedSessionIds ?? []);
    return new Set(ids);
  };

  const eligibleChildren = children.map(ch => {
    const age = getAge(ch.date_of_birth);
    // Has any cart item for non-pick plans (term/monthly) — used as a soft hint, NOT a disable
    const hasFullPlanItem = cartItems.some(ci =>
      ci.classId === c.id && ci.studentId === ch.id && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly" || ci.pricingPlan === "yearly")
    );
    // 6-month grace before the minimum age; the maximum stays strict.
    return { ...ch, age, eligible: isChildAgeEligible(ch.date_of_birth, c.age_min, c.age_max, age, c.class_type), hasFullPlanItem };
  });
  const hasEligible = eligibleChildren.some(ch => ch.eligible);

  const sessionsSelected = selSessions.length;
  const price = plan === "trial" ? priceTrial
    : plan === "term" ? priceTerm
    : plan === "monthly" ? priceMonthly
    : plan === "yearly" ? priceYearly
    : priceSession;

  const noKidsSelected = c.class_type === "children" && selKids.length === 0;
  const needsDates = plan === "session" || plan === "trial";
  const noSessionsSelected = needsDates && sessionsSelected === 0;
  // Booking is blocked until the attendee exists: a child on the account, or the adult self profile.
  const needsChild = c.class_type === "children" && children.length === 0;
  const needsSelfProfile = c.class_type === "adult" && !isAttendeeProfileComplete(selfStudent as any);

  const totalForDropIn = plan === "session" ? priceSession * sessionsSelected : price;
  const kidCount = selKids.length || 1;
  const displayPrice = plan === "session" ? (totalForDropIn || 0) * kidCount : (price || 0) * kidCount;

  const selfProfileReady = isAttendeeProfileComplete(selfStudent as any);

  const handleAddToCart = () => {
    if (!user) { navigate("/auth"); return; }
    if (noKidsSelected || noSessionsSelected) return;

    // Every booking needs a complete attendee profile for the register.
    // Open the profile form in place (prefilled with class times) rather than
    // dead-ending — the parent completes it and returns to the booking.
    if (c.class_type === "adult") {
      if (!selfProfileReady) {
        setChildDialog({ editing: selfStudent, selfMode: true });
        return;
      }
    } else {
      const incomplete = selKids
        .map(kid => children.find(ch => ch.id === kid))
        .find(ch => ch && !isAttendeeProfileComplete(ch as any));
      if (incomplete) {
        setChildDialog({ editing: incomplete, selfMode: false });
        return;
      }
    }

    const formatDate = (sid: string) => {
      const s = sessions.find(ss => ss.id === sid);
      return s ? format(parseISO(s.session_date), "d MMM") : "";
    };

    const buildItem = (
      childId: string | null,
      childName: string | null,
      sessionIds: string[],
    ) => ({
      id: `${c.id}-${childId || "self"}-${Date.now()}-${Math.random()}`,
      classId: c.id,
      className: c.name,
      classType: c.class_type,
      danceStyle: c.dance_style,
      dayOfWeek: c.day_of_week,
      startTime: c.start_time,
      endTime: c.end_time,
      venueName: c.venues?.name || null,
      studentId: childId,
      studentName: childName,
      pricingPlan: plan,
      unitPrice: plan === "session" ? priceSession : (price || 0),
      totalPrice: plan === "session" ? priceSession * sessionIds.length : (price || 0),
      sessionsCount: plan === "term" ? remaining
        : plan === "session" ? sessionIds.length
        : plan === "trial" ? 1
        : null,
      termDiscountPercent: plan === "term" ? termSavings : null,
      workshopImage: getWorkshopImageUrl(c.workshops?.cover_image),
      selectedSessionIds: sessionIds,
      selectedSessionDates: sessionIds.map(formatDate),
    });

    // Track per-child what was added vs skipped, to build a clear toast summary
    const addedSummary: { name: string; count: number }[] = [];
    const skippedSummary: { name: string; dates: string[] }[] = [];
    let didAddAnything = false;

    if (c.class_type === "children" && selKids.length > 0) {
      for (const childId of selKids) {
        const child = children.find(ch => ch.id === childId);
        const childName = child ? (child.preferred_name || child.first_name) : "Child";
        const fullName = child ? `${child.first_name} ${child.last_name}` : null;

        if (isPickPlan) {
          const alreadyHas = childSessionsInBasket(childId);
          const newSessions = selSessions.filter(sid => !alreadyHas.has(sid));
          const skipped = selSessions.filter(sid => alreadyHas.has(sid));

          if (newSessions.length > 0) {
            addItem(buildItem(childId, fullName, newSessions));
            addedSummary.push({ name: childName, count: newSessions.length });
            didAddAnything = true;
          }
          if (skipped.length > 0) {
            skippedSummary.push({ name: childName, dates: skipped.map(formatDate) });
          }
        } else {
          // term / monthly — one item per child; skip if they already have a full-plan item
          const hasFull = cartItems.some(ci =>
            ci.classId === c.id && ci.studentId === childId && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly" || ci.pricingPlan === "yearly")
          );
          if (hasFull) {
            skippedSummary.push({ name: childName, dates: [] });
          } else {
            addItem(buildItem(childId, fullName, selSessions));
            addedSummary.push({ name: childName, count: 1 });
            didAddAnything = true;
          }
        }
      }
    } else {
      // Adult class — booked against the account holder's self attendee profile
      const selfId = selfStudent!.id;
      const selfName = `${selfStudent!.first_name} ${selfStudent!.last_name}`;
      if (isPickPlan) {
        const alreadyHas = adultSessionsInBasket();
        const newSessions = selSessions.filter(sid => !alreadyHas.has(sid));
        const skipped = selSessions.filter(sid => alreadyHas.has(sid));

        if (newSessions.length > 0) {
          addItem(buildItem(selfId, selfName, newSessions));
          addedSummary.push({ name: "you", count: newSessions.length });
          didAddAnything = true;
        }
        if (skipped.length > 0) {
          skippedSummary.push({ name: "you", dates: skipped.map(formatDate) });
        }
      } else {
        const hasFull = cartItems.some(ci =>
          ci.classId === c.id && (!ci.studentId || ci.studentId === selfId) && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly" || ci.pricingPlan === "yearly")
        );
        if (hasFull) {
          skippedSummary.push({ name: "you", dates: [] });
        } else {
          addItem(buildItem(selfId, selfName, selSessions));
          didAddAnything = true;
        }
      }
    }

    // Build toast
    if (!didAddAnything && skippedSummary.length > 0) {
      const desc = skippedSummary
        .map(s => s.dates.length > 0 ? `${s.name}: ${s.dates.join(", ")}` : `${s.name}: full plan already in basket`)
        .join(" · ");
      toast.info("Already in your basket", { description: desc });
      return; // keep dialog open so they can adjust
    }

    if (didAddAnything && skippedSummary.length > 0) {
      const skippedDesc = skippedSummary
        .map(s => s.dates.length > 0 ? `${s.name}: ${s.dates.join(", ")}` : `${s.name}: full plan`)
        .join(" · ");
      toast.success("Added to basket", { description: `Skipped (already in basket) — ${skippedDesc}` });
    } else if (didAddAnything) {
      const addedDesc = isPickPlan
        ? addedSummary.map(s => `${s.name}: ${s.count} session${s.count === 1 ? "" : "s"}`).join(" · ")
        : addedSummary.map(s => s.name).join(", ");
      if (addedDesc) {
        toast.success("Added to basket", { description: addedDesc });
      } else {
        toast.success("Added to basket");
      }
    }

    onOpenChange(false);
  };

  // ── Presentation ──────────────────────────────────────────────────────

  // Sheets portal to <body>, which carries the page theme; portal-ui keeps
  // the title in the product face rather than the marketing headline face.
  const themeClass = "portal-ui";

  // The plan the class pre-selects for a child — the one worth recommending.
  const recommendedPlan = isChildren ? defaultChildPlan(c, sessions.length > 0) : null;

  const planOptions: PlanOption<PricingPlan>[] = [];
  if (isChildren && isTrialEligible) {
    planOptions.push({ id: "trial", title: "Trial class", meta: "The price of one class", price: formatPrice(priceTrial) });
  }
  if (!isChildren) {
    planOptions.push({
      id: "session",
      title: "Pay as you go",
      meta: "Pick your dates · move up to 24h before",
      price: formatPrice(priceSession),
      priceSuffix: "/class",
    });
  }
  if (isChildren && offersMonthly(c)) {
    planOptions.push({
      id: "monthly",
      title: "Monthly membership",
      meta: "Rolling · billed on the 5th · 12th month free",
      price: formatPrice(priceMonthly),
      priceSuffix: "/month",
      badge: recommendedPlan === "monthly" ? "Recommended" : undefined,
    });
  }
  if (isChildren && offersTermly(c) && priceTerm != null && remaining > 0) {
    planOptions.push({
      id: "term",
      title: "Pay for the term",
      meta: `All ${remaining} sessions this term`,
      price: formatPrice(priceTerm),
      badge: `Save ${termSavings}%`,
    });
  }
  if (isChildren && offersYearly(c)) {
    planOptions.push({
      id: "yearly",
      title: "Pay for the year",
      meta: "Sept–July · 38 weeks",
      price: formatPrice(priceYearly),
      badge: `Save ${yearlySavings}%`,
    });
  }

  const attendeeOptions: AttendeeOption[] = eligibleChildren.map(ch => {
    // Inline hint: only flag when at least one currently-picked session is already in THIS child's basket
    const childBasket = isPickPlan ? childSessionsInBasket(ch.id) : new Set<string>();
    const overlapCount = isPickPlan ? selSessions.filter(sid => childBasket.has(sid)).length : 0;
    const showInBasketHint = (isPickPlan && overlapCount > 0) || (!isPickPlan && ch.hasFullPlanItem);
    const hint = showInBasketHint ? (isPickPlan ? `${overlapCount} in basket` : "in basket") : null;
    return {
      id: ch.id,
      name: `${ch.first_name} ${ch.last_name}`,
      subtitle: joinNotes([`Age ${ch.age}`, hint]),
      initials: initialsFor(ch.first_name, ch.last_name),
      disabled: !ch.eligible,
      disabledReason: "Not in this age group",
    };
  });

  // Dates already in the basket for the current selection — a hint on the tile.
  // Children: every selected child already has it. Adults: it is in their basket.
  const adultBasket = !isChildren ? adultSessionsInBasket() : null;
  const dateOptions = sessions.map(s => {
    let inBasket = false;
    if (isChildren) {
      if (selKids.length > 0) inBasket = selKids.every(kid => childSessionsInBasket(kid).has(s.id));
    } else {
      inBasket = adultBasket!.has(s.id);
    }
    return { id: s.id, date: s.session_date, startTime: s.start_time, endTime: s.end_time, inBasket };
  });

  const kids = selKids.length;
  const kidsNote = kids > 1 ? `${kids} children` : null;
  const priceSummary = displayPrice
    ? plan === "monthly"
      ? { amount: formatPrice(displayPrice), suffix: "/month", note: joinNotes([kids > 1 && `${formatPrice(price || 0)} × ${kids} children`]) }
      : plan === "term"
        ? { amount: formatPrice(displayPrice), suffix: "/term", note: joinNotes([`All ${remaining} sessions`, kids > 1 && `${formatPrice(price || 0)} × ${kids} children`]) }
        : plan === "yearly"
          ? { amount: formatPrice(displayPrice), suffix: "/year", note: joinNotes(["Sept–July", kids > 1 && `${formatPrice(price || 0)} × ${kids} children`]) }
          : plan === "trial"
            ? { amount: formatPrice(displayPrice), suffix: undefined, note: joinNotes(["One trial class", kidsNote]) }
            : {
                amount: formatPrice(displayPrice),
                suffix: undefined,
                note: joinNotes([
                  `${formatPrice(priceSession)} × ${sessionsSelected} ${sessionsSelected === 1 ? "session" : "sessions"}`,
                  kids > 1 && `× ${kids} children`,
                ]),
              }
    : null;
  const priceHint = plan === "trial" ? "Pick a date for the trial" : "Pick your dates to see the price";

  const ctaLabel = !user ? "Sign in to book"
    : needsChild ? "Add a child"
    : needsSelfProfile ? "Set up your profile"
    : noSessionsSelected ? "Select dates"
    : noKidsSelected ? "Select child"
    : plan === "trial" ? "Book trial"
    : selKids.length > 1 ? `Add ${selKids.length} to basket`
    : "Add to basket";

  const selfName = selfStudent ? `${selfStudent.first_name} ${selfStudent.last_name}` : null;

  return (
    <>
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={c.name}
      description={joinNotes([formatDay(c.day_of_week, "plural"), formatTimeRange(c.start_time, c.end_time), c.venues?.name])}
      themeClass={themeClass}
      bodyClassName="pt-1"
      footer={
        <BookingSheetFooter
          amount={priceSummary?.amount}
          amountSuffix={priceSummary?.suffix}
          note={priceSummary?.note || undefined}
          hint={priceHint}
          action={
            <Button
              size="xl"
              className="rounded-full px-6"
              /* Only truly dead when there is nothing to pick: a class with no
                 dates left can't be booked by date. Everything else the button
                 can act on, so it stays live and takes you there. */
              disabled={needsDates && sessions.length === 0}
              onClick={() => {
                if (needsChild) return setChildDialog({ editing: null, selfMode: false });
                if (needsSelfProfile) return setChildDialog({ editing: selfStudent, selfMode: true });
                if (noKidsSelected) return scrollTo(attendeesRef);
                if (noSessionsSelected) return scrollTo(datesRef);
                // Monthly membership: explicit cancellation-notice acknowledgement first.
                if (plan === "monthly") return setMonthlyNoticeOpen(true);
                handleAddToCart();
              }}
            >
              {ctaLabel}
            </Button>
          }
        />
      }
    >
      <div className="space-y-7 pb-2">
        {/* Plan */}
        <BookingSection label="Plan">
          <PlanPicker<PricingPlan> options={planOptions} value={plan} onChange={setPlan} />
          {plan === "monthly" && (
            <div className="space-y-2 px-1 text-[13px] leading-relaxed text-muted-foreground">
              <p>{MONTHLY_PAYMENT_INFO}</p>
              {isChildren && <p>{UNLIMITED_CAP_INFO}</p>}
            </div>
          )}
        </BookingSection>

        {/* Who's attending — choose WHO before WHEN */}
        {c.class_type === "children" && user && children.length > 0 && (
          <div ref={attendeesRef}>
          <BookingSection label="Who's attending">
            {!hasEligible && (
              <p className="text-[13px] text-warning">
                None of your children are in the age range{c.age_min != null && c.age_max != null ? ` (ages ${c.age_min}–${c.age_max})` : ""}.
              </p>
            )}
            <AttendeePicker
              options={attendeeOptions}
              value={selKids}
              onChange={setSelKids}
              multiple
              onAdd={() => setChildDialog({ editing: null, selfMode: false })}
              addLabel="Add a child"
            />
          </BookingSection>
          </div>
        )}

        {c.class_type === "children" && user && children.length === 0 && (
          <BookingSection label="Who's attending">
            <BookingPromptCard
              title="Add your child to book them in"
              body="We'll pre-fill their arrival and pickup times from the class."
              actionLabel="Add a child"
              onAction={() => setChildDialog({ editing: null, selfMode: false })}
            />
          </BookingSection>
        )}

        {c.class_type === "adult" && user && (
          <BookingSection label="Who's attending">
            {needsSelfProfile ? (
              <BookingPromptCard
                title={selfStudent ? "Complete your attendee profile" : "Set up your attendee profile"}
                body="We need your details for the class register — your age and any medical information."
                actionLabel={selfStudent ? "Complete your profile" : "Set up your profile"}
                onAction={() => setChildDialog({ editing: selfStudent, selfMode: true })}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {initialsFor(selfStudent?.first_name, selfStudent?.last_name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-foreground">Booking for {selfName}</span>
                  <span className="block text-[13px] text-muted-foreground">Your attendee profile</span>
                </span>
              </div>
            )}
          </BookingSection>
        )}

        {/* Dates — pay as you go picks several, a trial picks one */}
        {(plan === "session" || plan === "trial") && (
          <div ref={datesRef}>
          <BookingSection label={plan === "trial" ? "Trial date" : "Dates"}>
            {sessions.length > 0 ? (
              <SessionDatePicker
                sessions={dateOptions}
                value={selSessions}
                onChange={setSelSessions}
                multiple={plan === "session"}
                emptySummary={plan === "trial" ? "Pick the date of your trial" : undefined}
                ariaLabel={plan === "trial" ? "Choose your trial date" : "Choose dates"}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">No upcoming dates to book yet.</p>
            )}
          </BookingSection>
          </div>
        )}
      </div>
    </ResponsiveSheet>

    {/* Monthly membership cancellation notice — must be acknowledged before basket add */}
    <MonthlyNoticeDialog
      open={monthlyNoticeOpen}
      onOpenChange={setMonthlyNoticeOpen}
      onAgree={handleAddToCart}
      agreeLabel="I agree, add to basket"
      themeClass={themeClass}
    />

    {/* Add / complete an attendee profile in place */}
    <ChildFormDialog
      open={!!childDialog}
      onOpenChange={(o) => { if (!o) setChildDialog(null); }}
      editing={childDialog?.editing ?? null}
      selfMode={childDialog?.selfMode ?? false}
      onSaved={() => { onChildrenChanged?.(); setChildDialog(null); }}
    />
    </>
  );
}
