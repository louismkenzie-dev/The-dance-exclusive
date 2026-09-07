import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { offersMonthly, offersTermly, offersYearly, type PlanFlags } from "@/lib/classPlans";
import { useCart, cartItemKind, type CartItem, type PricingPlan } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/bookingFormat";
import { ResponsiveSheet, PlanPicker, Bone, type PlanOption } from "@/components/booking";
import { BookingSection } from "@/components/booking/BookingSection";
import { BookingSheetFooter } from "@/components/booking/BookingSheetFooter";
import { MonthlyNoticeDialog } from "@/components/booking/MonthlyNoticeDialog";
import { SessionDatePicker } from "@/components/booking/SessionDatePicker";
import {
  MONTHLY_PAYMENT_INFO,
  UNLIMITED_CAP_INFO,
  monthlyPrice,
  termPrice,
  termlySavingsPercent,
  yearlyPrice,
  yearlySavingsPercent,
  type PricedClass,
} from "@/lib/pricing";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

interface EditCartItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CartItem | null;
}

export function EditCartItemDialog({ open, onOpenChange, item }: EditCartItemDialogProps) {
  const { updateItem } = useCart();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selSessions, setSelSessions] = useState<string[]>([]);
  const [classRow, setClassRow] = useState<(PricedClass & PlanFlags) | null>(null);
  const [plan, setPlan] = useState<PricingPlan>("monthly");
  const [monthlyNoticeOpen, setMonthlyNoticeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const [sessionsRes, classRes] = await Promise.all([
        item.classId
          ? supabase
              .from("class_sessions")
              .select("id, session_date, start_time, end_time, status")
              .eq("class_id", item.classId)
              .gte("session_date", today)
              .order("session_date", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        item.classId
          ? supabase
              .from("classes")
              .select("class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, allow_monthly, allow_termly, allow_yearly")
              .eq("id", item.classId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const upcoming = ((sessionsRes.data as any[]) ?? []).filter((s: any) => s.status !== "cancelled");
      setSessions(upcoming);
      setSelSessions(item.selectedSessionIds ?? []);
      setClassRow((classRes.data as (PricedClass & PlanFlags) | null) ?? null);
      setPlan(item.pricingPlan);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [open, item]);

  if (!item) return null;

  const isDropIn = item.pricingPlan === "session";
  const isTrial = item.pricingPlan === "trial";
  const isMembership = item.pricingPlan === "monthly" || item.pricingPlan === "term" || item.pricingPlan === "yearly";
  // Plan switching: children's class memberships only (camps, passes and adult
  // pay-as-you-go have no alternative plans to switch between).
  const canSwitchPlan = cartItemKind(item) === "class" && !!item.classId && isMembership && item.classType === "children";
  const isLocked = isMembership && !canSwitchPlan;

  const remaining = sessions.length;
  const priceMonthly = classRow ? monthlyPrice(classRow) : null;
  const priceYearly = classRow ? yearlyPrice(classRow) : null;
  const priceTerm = classRow ? termPrice(classRow, remaining) : null;
  const termSavings = termlySavingsPercent();
  const yearlySavings = yearlySavingsPercent();

  const planLabel: Partial<Record<PricingPlan, string>> = {
    monthly: "Monthly Membership",
    term: "Pay Termly",
    yearly: "Pay Yearly",
  };

  const applyPlanChange = () => {
    if (!classRow) return;
    const allIds = sessions.map(s => s.id);
    const allDates = sessions.map(s => format(parseISO(s.session_date), "d MMM"));
    let unit: number | null = null;
    let sessionsCount: number | null = null;
    let termPct: number | null = null;
    if (plan === "monthly") {
      unit = priceMonthly;
    } else if (plan === "yearly") {
      unit = priceYearly;
    } else if (plan === "term") {
      unit = priceTerm;
      sessionsCount = remaining;
      termPct = termSavings;
    }
    if (unit == null) return;

    updateItem(item.id, {
      pricingPlan: plan,
      unitPrice: unit,
      totalPrice: unit,
      sessionsCount,
      termDiscountPercent: termPct,
      selectedSessionIds: allIds,
      selectedSessionDates: allDates,
    });
    toast.success("Plan updated", {
      description: `${item.className} switched to ${planLabel[plan] ?? plan} — £${unit.toFixed(2)}. Multi-class and sibling discounts are applied at checkout.`,
    });
    onOpenChange(false);
  };

  const handleSave = () => {
    if (canSwitchPlan) {
      if (plan === item.pricingPlan) {
        onOpenChange(false);
        return;
      }
      // Switching TO monthly requires the same cancellation-notice
      // acknowledgement as adding a monthly membership from the timetable.
      if (plan === "monthly") {
        setMonthlyNoticeOpen(true);
        return;
      }
      applyPlanChange();
      return;
    }

    const sessionDates = selSessions.map(sid => {
      const s = sessions.find(ss => ss.id === sid);
      return s ? format(parseISO(s.session_date), "d MMM") : "";
    }).filter(Boolean);

    const count = selSessions.length;
    const totalPrice = isDropIn ? item.unitPrice * count : item.totalPrice;

    updateItem(item.id, {
      selectedSessionIds: selSessions,
      selectedSessionDates: sessionDates,
      sessionsCount: isDropIn ? count : item.sessionsCount,
      totalPrice,
    });
    onOpenChange(false);
  };

  const canSave = canSwitchPlan ? (!loading && !!classRow) : selSessions.length > 0;

  // ── Presentation ──────────────────────────────────────────────────────

  // The dialog portals to <body>, which carries the page theme.
  const themeClass = "portal-ui";

  // Same options as the booking sheet; the item's current plan is always
  // listed so it can be seen (and kept) even if the class no longer offers it.
  const planOptions: PlanOption<PricingPlan>[] = [];
  if (classRow) {
    if (priceMonthly != null && (offersMonthly(classRow) || item.pricingPlan === "monthly")) {
      planOptions.push({
        id: "monthly",
        title: "Monthly membership",
        meta: "Rolling · billed on the 5th · 12th month free",
        price: formatPrice(priceMonthly),
        priceSuffix: "/month",
      });
    }
    if (priceTerm != null && remaining > 0 && (offersTermly(classRow) || item.pricingPlan === "term")) {
      planOptions.push({
        id: "term",
        title: "Pay for the term",
        meta: `All ${remaining} sessions this term`,
        price: formatPrice(priceTerm),
        badge: `Save ${termSavings}%`,
      });
    }
    if (priceYearly != null && (offersYearly(classRow) || item.pricingPlan === "yearly")) {
      planOptions.push({
        id: "yearly",
        title: "Pay for the year",
        meta: "Sept–July · 38 weeks",
        price: formatPrice(priceYearly),
        badge: `Save ${yearlySavings}%`,
      });
    }
  }

  const dateOptions = sessions.map(s => ({ id: s.id, date: s.session_date, startTime: s.start_time, endTime: s.end_time }));

  const showPrice = !isLocked && !canSwitchPlan && isDropIn;
  const count = selSessions.length;

  const skeleton = (
    <div className="space-y-2" aria-hidden>
      <Bone className="h-[68px] w-full rounded-2xl" />
      <Bone className="h-[68px] w-full rounded-2xl" />
      <Bone className="h-[68px] w-full rounded-2xl" />
    </div>
  );

  const note = (text: string) => (
    <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
  );

  return (
    <>
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={canSwitchPlan ? "Change plan" : "Edit dates"}
      description={`${item.className}${item.studentName ? ` · for ${item.studentName}` : ""}`}
      themeClass={themeClass}
      bodyClassName="pt-1"
      footer={
        <BookingSheetFooter
          amount={showPrice && count > 0 ? formatPrice(item.unitPrice * count) : null}
          note={showPrice && count > 0 ? `${formatPrice(item.unitPrice)} × ${count} ${count === 1 ? "session" : "sessions"}` : undefined}
          hint={showPrice ? "Pick at least one date" : undefined}
          action={
            <>
              <Button variant="soft" size="xl" className="rounded-full px-5" onClick={() => onOpenChange(false)}>
                {isLocked ? "Close" : "Cancel"}
              </Button>
              {!isLocked && (
                <Button size="xl" className="rounded-full px-6" onClick={handleSave} disabled={!canSave}>
                  Save changes
                </Button>
              )}
            </>
          }
        />
      }
    >
      <div className="space-y-7 pb-2">
        {canSwitchPlan ? (
          <BookingSection label="Plan">
            {loading ? (
              skeleton
            ) : !classRow ? (
              note("Couldn't load this class's pricing. Please try again.")
            ) : (
              <>
                <PlanPicker<PricingPlan> options={planOptions} value={plan} onChange={setPlan} />
                {plan === "monthly" && (
                  <div className="space-y-2 px-1 text-[13px] leading-relaxed text-muted-foreground">
                    <p>{MONTHLY_PAYMENT_INFO}</p>
                    <p>{UNLIMITED_CAP_INFO}</p>
                  </div>
                )}
                {note("Multi-class and sibling discounts stay applied — they're worked out automatically at checkout, whichever plan you pick.")}
              </>
            )}
          </BookingSection>
        ) : isLocked ? (
          note(`This booking covers all sessions in the ${item.pricingPlan === "term" ? "term" : "subscription"} and can't be edited here — remove and re-add to change it.`)
        ) : (
          <BookingSection label={isTrial ? "Trial date" : "Dates"}>
            {loading ? (
              <div className="flex gap-2" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => <Bone key={i} className="h-[68px] w-[54px] rounded-2xl" />)}
              </div>
            ) : sessions.length === 0 ? (
              note("No upcoming sessions available.")
            ) : (
              <SessionDatePicker
                sessions={dateOptions}
                value={selSessions}
                onChange={setSelSessions}
                multiple={!isTrial}
                selectAll={!isTrial}
                emptySummary={isTrial ? "Pick the date of the trial" : undefined}
                ariaLabel={isTrial ? "Choose the trial date" : "Choose dates"}
              />
            )}
          </BookingSection>
        )}
      </div>
    </ResponsiveSheet>

    {/* Monthly membership cancellation notice — same acknowledgement as when adding from the timetable */}
    <MonthlyNoticeDialog
      open={monthlyNoticeOpen}
      onOpenChange={setMonthlyNoticeOpen}
      onAgree={applyPlanChange}
      agreeLabel="I agree, switch plan"
      themeClass={themeClass}
    />
    </>
  );
}
