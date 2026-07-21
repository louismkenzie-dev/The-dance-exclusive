import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, CalendarRange, Repeat, ShoppingCart, Sparkles, Tag, Ticket, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, type PricingPlan } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";

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

export function QuickBookDialog({
  open,
  onOpenChange,
  classData,
  sessions,
  children,
  hasExistingBookings,
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
  // Add / complete an attendee profile without leaving the booking dialog.
  const [childDialog, setChildDialog] = useState<{ editing: any | null; selfMode: boolean } | null>(null);

  // Reset selections when class changes / dialog opens
  useEffect(() => {
    if (open && classData) {
      setSelSessions([]);
      setSelKids([]);
      if (classData.allow_trial && hasExistingBookings === false) {
        setPlan("trial");
      } else if (classData.price_per_session) {
        setPlan("session");
      } else if (classData.price_per_term) {
        setPlan("term");
      } else if (classData.price_per_month || classData.price_per_year) {
        setPlan("monthly");
      }
    }
  }, [open, classData, hasExistingBookings]);

  // Auto-select sessions for term/monthly plans (must run before any early return)
  useEffect(() => {
    if (!open || !classData) return;
    if (plan === "term" || plan === "monthly") {
      setSelSessions(sessions.map(s => s.id));
    } else if (plan === "session" || plan === "trial") {
      setSelSessions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, open, classData?.id]);

  if (!classData) return null;
  const c = classData;

  const remaining = sessions.length;
  const isTrialEligible = c.allow_trial && hasExistingBookings === false;
  const annualMonthlyCost = c.price_per_year ? c.price_per_year / 12 : null;
  const termSavings = c.price_per_session && c.price_per_term && remaining > 0
    ? Math.round((1 - c.price_per_term / (c.price_per_session * remaining)) * 100)
    : c.term_discount_percent || 0;
  const annualSavings = c.price_per_session && c.price_per_year
    ? Math.round((1 - (c.price_per_year / 12) / (c.price_per_session * 4)) * 100)
    : c.monthly_discount_percent || 0;

  const toggleSession = (id: string) => {
    setSelSessions(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleKid = (id: string) => {
    setSelKids(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  };

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
    const tooYoung = c.age_min != null && age < c.age_min;
    const tooOld = c.age_max != null && age > c.age_max;
    // Has any cart item for non-pick plans (term/monthly) — used as a soft hint, NOT a disable
    const hasFullPlanItem = cartItems.some(ci =>
      ci.classId === c.id && ci.studentId === ch.id && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly")
    );
    return { ...ch, age, eligible: !tooYoung && !tooOld, hasFullPlanItem };
  });
  const hasEligible = eligibleChildren.some(ch => ch.eligible);

  const sessionsSelected = selSessions.length;
  const price = plan === "trial" ? 0
    : plan === "term" ? c.price_per_term
    : plan === "monthly" ? (annualMonthlyCost || c.price_per_month)
    : c.price_per_session;

  const noKidsSelected = c.class_type === "children" && selKids.length === 0;
  const noSessionsSelected = (plan === "session" || plan === "trial") && sessionsSelected === 0;
  // Booking is blocked until the attendee exists: a child on the account, or the adult self profile.
  const needsChild = c.class_type === "children" && children.length === 0;
  const needsSelfProfile = c.class_type === "adult" && !isAttendeeProfileComplete(selfStudent as any);

  const totalForDropIn = plan === "session" && c.price_per_session ? c.price_per_session * sessionsSelected : price;
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
      unitPrice: plan === "session" ? (c.price_per_session || 0) : (price || 0),
      totalPrice: plan === "session" ? (c.price_per_session || 0) * sessionIds.length : (price || 0),
      sessionsCount: plan === "term" ? remaining : plan === "session" ? sessionIds.length : null,
      termDiscountPercent: plan === "term" ? (c.term_discount_percent || null) : null,
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
            ci.classId === c.id && ci.studentId === childId && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly")
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
          ci.classId === c.id && (!ci.studentId || ci.studentId === selfId) && (ci.pricingPlan === "term" || ci.pricingPlan === "monthly")
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

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold tracking-tight">{c.name}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1)} · {c.start_time?.slice(0, 5)}–{c.end_time?.slice(0, 5)}
            {c.venues && <> · {c.venues.name}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Plan selector */}
          <div className="space-y-3">
            <p className="eyebrow flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Choose your plan
            </p>
            <div className="grid gap-2.5">
              {isTrialEligible && (
                <button
                  type="button"
                  onClick={() => setPlan("trial")}
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3 text-left text-sm transition-all ${
                    plan === "trial"
                      ? "bg-success/10 ring-2 ring-success"
                      : "bg-secondary/60 hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">Free trial session</span>
                      <span className="block text-xs text-muted-foreground">No commitment — come have fun!</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-bold text-success">Free</span>
                </button>
              )}
              {c.price_per_session && (
                <button
                  type="button"
                  onClick={() => setPlan("session")}
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3 text-left text-sm transition-all ${
                    plan === "session"
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary/60 hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Ticket className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">Drop-in sessions</span>
                      <span className="block text-xs text-muted-foreground">Pick the dates you want to attend</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-bold tabular-nums text-foreground">
                    £{c.price_per_session}
                    <span className="font-body text-xs font-normal text-muted-foreground">/each</span>
                  </span>
                </button>
              )}
              {c.price_per_term && remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setPlan("term")}
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3 text-left text-sm transition-all ${
                    plan === "term"
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary/60 hover:bg-secondary"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <CalendarRange className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">Full term</span>
                      <span className="block text-xs text-muted-foreground">All {remaining} sessions · save vs drop-in</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display font-bold tabular-nums text-foreground">£{c.price_per_term}</span>
                    {termSavings > 0 && (
                      <Badge variant="success" className="mt-0.5 text-[10px]">Save {termSavings}%</Badge>
                    )}
                  </span>
                </button>
              )}
              {(c.price_per_year || c.price_per_month) && (
                <button
                  type="button"
                  onClick={() => setPlan("monthly")}
                  className={`relative flex items-center justify-between gap-3 rounded-2xl p-3 text-left text-sm transition-all ${
                    plan === "monthly"
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary/60 hover:bg-secondary"
                  }`}
                >
                  <Badge variant="solid" className="absolute -top-2 right-3 text-[10px]">Best value</Badge>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Repeat className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">Monthly subscription</span>
                      <span className="block text-xs text-muted-foreground">Commit for the year · cheapest per class</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display font-bold tabular-nums text-foreground">
                      £{annualMonthlyCost?.toFixed(2) || c.price_per_month}
                      <span className="font-body text-xs font-normal text-muted-foreground">/mo</span>
                    </span>
                    {annualSavings > 0 && (
                      <Badge variant="success" className="mt-0.5 text-[10px]">Save {annualSavings}%</Badge>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Children selector — choose WHO before WHEN */}
          {c.class_type === "children" && user && children.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">Select who to book on — add more than one and the price adds up:</p>
                <button
                  type="button"
                  onClick={() => setChildDialog({ editing: null, selfMode: false })}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <UserPlus className="h-3 w-3" /> Add a child
                </button>
              </div>
              {!hasEligible && (
                <p className="text-xs text-warning">
                  None of your children are in the age range{c.age_min != null && c.age_max != null ? ` (ages ${c.age_min}–${c.age_max})` : ""}.
                </p>
              )}
              {eligibleChildren.map(ch => {
                // Inline hint: only flag when at least one currently-picked session is already in THIS child's basket
                const childBasket = isPickPlan ? childSessionsInBasket(ch.id) : new Set<string>();
                const overlapCount = isPickPlan
                  ? selSessions.filter(sid => childBasket.has(sid)).length
                  : 0;
                const showInBasketHint = (isPickPlan && overlapCount > 0) || (!isPickPlan && ch.hasFullPlanItem);
                return (
                  <label
                    key={ch.id}
                    className={`flex items-center gap-3 rounded-2xl p-3 text-sm transition-all ${
                      !ch.eligible
                        ? "cursor-not-allowed bg-secondary/40 opacity-50"
                        : selKids.includes(ch.id)
                          ? "cursor-pointer bg-primary/10 ring-2 ring-primary"
                          : "cursor-pointer bg-secondary/60 hover:bg-secondary"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selKids.includes(ch.id)}
                      disabled={!ch.eligible}
                      onChange={() => toggleKid(ch.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="flex-1 font-medium text-foreground">
                      {ch.first_name} {ch.last_name}
                      <span className="ml-1 font-normal text-muted-foreground">(age {ch.age})</span>
                    </span>
                    {!ch.eligible && <span className="text-xs text-warning">Not in age group</span>}
                    {ch.eligible && showInBasketHint && (
                      <span className="text-xs text-muted-foreground">
                        {isPickPlan ? `${overlapCount} in basket` : "In basket"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {c.class_type === "children" && user && children.length === 0 && (
            <div className="space-y-3 rounded-2xl bg-warning/10 p-4 text-sm text-foreground">
              <p>Add your child's details to book them in — we'll pre-fill their arrival and pickup times from the class.</p>
              <Button size="sm" onClick={() => setChildDialog({ editing: null, selfMode: false })}>
                <UserPlus /> Add a child
              </Button>
            </div>
          )}

          {/* Drop-in: pick dates */}
          {plan === "session" && sessions.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">Select sessions to attend:</p>
                <button
                  type="button"
                  onClick={() => setSelSessions(selSessions.length === sessions.length ? [] : sessions.map(s => s.id))}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {selSessions.length === sessions.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {sessions.map(s => {
                  const isSel = selSessions.includes(s.id);
                  // Inline hint: only show "in basket" if relevant for the user's current selection.
                  // Children: show when EVERY selected kid already has this session.
                  // Adults: show when this session is in the adult cart.
                  let inBasketForSelection = false;
                  if (c.class_type === "children") {
                    if (selKids.length > 0) {
                      inBasketForSelection = selKids.every(kid => childSessionsInBasket(kid).has(s.id));
                    }
                  } else {
                    inBasketForSelection = adultSessionsInBasket().has(s.id);
                  }
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-sm transition-all ${
                        isSel
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "bg-secondary/60 hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSession(s.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 font-medium text-foreground">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                      {inBasketForSelection ? (
                        <span className="text-xs text-muted-foreground">In basket</span>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trial: pick one */}
          {plan === "trial" && sessions.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground">Pick your trial session:</p>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {sessions.map(s => {
                  const isSel = selSessions.includes(s.id);
                  let inBasketForSelection = false;
                  if (c.class_type === "children") {
                    if (selKids.length > 0) {
                      inBasketForSelection = selKids.every(kid => childSessionsInBasket(kid).has(s.id));
                    }
                  } else {
                    inBasketForSelection = adultSessionsInBasket().has(s.id);
                  }
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-sm transition-all ${
                        isSel
                          ? "bg-success/10 ring-2 ring-success"
                          : "bg-secondary/60 hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`qb-trial-${c.id}`}
                        checked={isSel}
                        onChange={() => setSelSessions([s.id])}
                        className="h-4 w-4 accent-success"
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 font-medium text-foreground">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                      {inBasketForSelection ? (
                        <span className="text-xs text-muted-foreground">In basket</span>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

        </div>


        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-card/95 px-6 py-4 backdrop-blur">
          <div>
            {plan === "trial" ? (
              <span className="font-display text-xl font-bold text-success">Free</span>
            ) : displayPrice ? (
              <span className="font-display text-xl font-bold tabular-nums text-foreground">
                £{displayPrice.toFixed(2).replace(/\.00$/, "")}
                <span className="ml-0.5 font-body text-xs font-normal text-muted-foreground">
                  /{plan === "term" ? "term" : plan === "monthly" ? "mo" : sessionsSelected > 1 ? `${sessionsSelected} sessions` : "session"}
                </span>
                {selKids.length > 1 && (
                  <span className="ml-1 font-body text-xs font-normal text-muted-foreground">× {selKids.length} children</span>
                )}
              </span>
            ) : null}
          </div>
          <Button
            disabled={(needsChild || needsSelfProfile) ? false : (noKidsSelected || noSessionsSelected)}
            onClick={() => {
              if (needsChild) return setChildDialog({ editing: null, selfMode: false });
              if (needsSelfProfile) return setChildDialog({ editing: selfStudent, selfMode: true });
              handleAddToCart();
            }}
            className={plan === "trial" ? "bg-success text-success-foreground hover:bg-success/90" : undefined}
          >
            {(needsChild || needsSelfProfile) ? <UserPlus /> : <ShoppingCart />}
            {!user ? "Sign in to book"
              : needsChild ? "Add a child"
              : needsSelfProfile ? "Set up your profile"
              : noSessionsSelected ? "Select sessions"
              : noKidsSelected ? "Select child"
              : plan === "trial" ? "Book free trial"
              : selKids.length > 1 ? `Add ${selKids.length} to basket`
              : "Add to basket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

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
