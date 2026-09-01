import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Tag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { offersMonthly, offersTermly, offersYearly, type PlanFlags } from "@/lib/classPlans";
import { useCart, cartItemKind, type CartItem, type PricingPlan } from "@/contexts/CartContext";
import {
  MONTHLY_MEMBERSHIP_NOTICE,
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

  const toggleSession = (id: string) => {
    if (isTrial) {
      setSelSessions([id]);
      return;
    }
    setSelSessions(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

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

  const planButton = (
    p: PricingPlan,
    title: string,
    subtitle: string,
    priceEl: React.ReactNode,
    badge?: React.ReactNode,
  ) => (
    <button
      onClick={() => setPlan(p)}
      className={`relative flex items-center justify-between p-2.5 rounded-lg border text-left text-sm transition-all ${
        plan === p
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border/50 bg-background/50 hover:border-border"
      }`}
    >
      {badge}
      <div>
        <span className="font-semibold text-foreground">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="text-right flex-shrink-0 ml-2">{priceEl}</div>
    </button>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-dialog flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-display">{canSwitchPlan ? "Change plan" : "Edit dates"}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {item.className} {item.studentName && <>· for {item.studentName}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {canSwitchPlan ? (
            loading ? (
              <div className="text-sm text-muted-foreground text-center py-6">Loading plans...</div>
            ) : !classRow ? (
              <div className="text-sm text-muted-foreground text-center py-6">Couldn't load this class's pricing. Please try again.</div>
            ) : (
              <>
                <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Choose Your Plan
                </p>
                <div className="grid gap-2">
                  {priceMonthly != null && (offersMonthly(classRow) || item.pricingPlan === "monthly") && planButton(
                    "monthly",
                    "Monthly Membership",
                    "Rolling monthly · billed on the 5th · 12th month free",
                    <span className="font-bold text-foreground">
                      £{priceMonthly.toFixed(2)}
                      <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                    </span>,
                  )}
                  {priceTerm != null && remaining > 0 && (offersTermly(classRow) || item.pricingPlan === "term") && planButton(
                    "term",
                    "Pay Termly",
                    `All ${remaining} sessions this term, upfront`,
                    <>
                      <span className="font-bold text-foreground">£{priceTerm.toFixed(2)}</span>
                      <Badge className="ml-1.5 bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">SAVE {termSavings}%</Badge>
                    </>,
                  )}
                  {priceYearly != null && (offersYearly(classRow) || item.pricingPlan === "yearly") && planButton(
                    "yearly",
                    "Pay Yearly",
                    "Sept–July upfront · all 38 dance weeks",
                    <>
                      <span className="font-bold text-foreground">£{priceYearly.toFixed(2)}</span>
                      <Badge className="ml-1.5 bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">SAVE {yearlySavings}%</Badge>
                    </>,
                    <div className="absolute -top-2 right-2">
                      <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0">BEST DEAL</Badge>
                    </div>,
                  )}
                </div>
                {plan === "monthly" && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{MONTHLY_PAYMENT_INFO}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{UNLIMITED_CAP_INFO}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
                  Multi-class and sibling discounts stay applied — they're worked out automatically at checkout, whichever plan you pick.
                </p>
              </>
            )
          ) : isLocked ? (
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              This booking covers all sessions in the {item.pricingPlan === "term" ? "term" : "subscription"} and can't be edited here — remove and re-add to change it.
            </div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground text-center py-6">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No upcoming sessions available.</div>
          ) : (
            <>
              {!isTrial && (
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {selSessions.length} session{selSessions.length !== 1 ? "s" : ""} selected
                  </p>
                  <button
                    onClick={() => setSelSessions(selSessions.length === sessions.length ? [] : sessions.map(s => s.id))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {selSessions.length === sessions.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
              )}
              <div className="grid gap-1.5">
                {sessions.map(s => {
                  const isSel = selSessions.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                        isSel ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 bg-background/50 hover:border-border"
                      }`}
                    >
                      <input
                        type={isTrial ? "radio" : "checkbox"}
                        name={isTrial ? `edit-trial-${item.id}` : undefined}
                        checked={isSel}
                        onChange={() => toggleSession(s.id)}
                        className="accent-primary w-4 h-4"
                      />
                      <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="flex-1 text-foreground font-medium">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                      <span className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 flex-row sm:justify-between items-center gap-2">
          {!isLocked && !canSwitchPlan && isDropIn && (
            <span className="text-sm font-bold text-foreground">
              £{(item.unitPrice * selSessions.length).toFixed(2)}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!isLocked && (
              <Button size="sm" onClick={handleSave} disabled={!canSave}>Save changes</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Monthly membership cancellation notice — same acknowledgement as when adding from the timetable */}
    <AlertDialog open={monthlyNoticeOpen} onOpenChange={setMonthlyNoticeOpen}>
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
          <AlertDialogAction onClick={() => { setMonthlyNoticeOpen(false); applyPlanChange(); }}>
            I agree — switch plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
