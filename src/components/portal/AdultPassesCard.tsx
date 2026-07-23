import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Gift, ShoppingCart, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";
import {
  ADULT_PASSES,
  BIRTHDAY_CLASS_WINDOW_DAYS,
  type AdultPassType,
} from "@/lib/pricing";

interface PassRow {
  id: string;
  pass_type: string;
  sessions_total: number;
  sessions_remaining: number;
  expires_at: string;
}

interface AdultPassesCardProps {
  /** Upcoming sessions of the listed adult classes, flattened across classes. */
  sessionOptions: SessionOption[];
  selfStudent: { id: string; date_of_birth: string | null } | null;
  /** Re-run after a redemption so listings/bookings refresh. */
  onRedeemed?: () => void;
}

const PASS_ORDER: AdultPassType[] = ["week_2", "pack_4", "pack_6", "pack_8"];

const daysSinceLastBirthday = (dob: string): number | null => {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  const last = thisYear > now
    ? new Date(Date.UTC(now.getUTCFullYear() - 1, birth.getUTCMonth(), birth.getUTCDate()))
    : thisYear;
  return Math.floor((now.getTime() - last.getTime()) / 86400000);
};

/** Adult multi-class passes: buy 2/4/6/8-class bundles, redeem them against
 *  any adult classes, and claim the free birthday class. */
export function AdultPassesCard({ sessionOptions, selfStudent, onRedeemed }: AdultPassesCardProps) {
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [redeeming, setRedeeming] = useState<{ mode: "pass" | "birthday"; pass?: PassRow } | null>(null);

  const fetchPasses = useCallback(() => {
    if (!user) { setPasses([]); return; }
    supabase
      .from("class_passes")
      .select("id, pass_type, sessions_total, sessions_remaining, expires_at")
      .eq("user_id", user.id)
      .gt("sessions_remaining", 0)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at")
      .then(({ data }) => setPasses((data as any) ?? []));
  }, [user]);
  useEffect(fetchPasses, [fetchPasses]);

  const birthdayDays = selfStudent?.date_of_birth
    ? daysSinceLastBirthday(selfStudent.date_of_birth)
    : null;
  const birthdayEligible = birthdayDays != null && birthdayDays <= BIRTHDAY_CLASS_WINDOW_DAYS;

  const buyPass = (type: AdultPassType) => {
    if (!user) { navigate("/auth"); return; }
    const pass = ADULT_PASSES[type];
    if (cartItems.some((ci) => ci.itemKind === "pass" && ci.passType === type)) {
      toast.info("That pass is already in your basket");
      return;
    }
    addItem({
      id: `pass-${type}-${Date.now()}`,
      classId: null,
      className: pass.label,
      classType: "adult",
      danceStyle: null,
      dayOfWeek: format(new Date(), "EEEE").toLowerCase(),
      startTime: "00:00",
      endTime: "00:00",
      venueName: null,
      studentId: selfStudent?.id ?? null,
      studentName: null,
      pricingPlan: "pass",
      unitPrice: pass.price,
      totalPrice: pass.price,
      sessionsCount: pass.sessions,
      termDiscountPercent: null,
      workshopImage: null,
      selectedSessionIds: [],
      selectedSessionDates: [],
      itemKind: "pass",
      passType: type,
    });
    toast.success("Pass added to basket", { description: pass.description });
  };

  const startRedeem = (mode: "pass" | "birthday", pass?: PassRow) => {
    setRedeeming({ mode, pass });
  };

  return (
    <>
      <Card className="border-border/50 bg-card/80 mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" /> Class Passes
          </CardTitle>
          <p className="text-sm text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
            Mix and match any adult classes. Passes are valid for 6 weeks from purchase
            (the 2-class pass covers one calendar week, Mon–Sun).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PASS_ORDER.map((type) => {
              const pass = ADULT_PASSES[type];
              return (
                <button
                  key={type}
                  onClick={() => buyPass(type)}
                  className="p-3 rounded-lg border border-border/50 bg-background/50 hover:border-primary/50 text-left transition-all group"
                >
                  <span className="block font-semibold text-foreground text-sm">{pass.label}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">{pass.description}</span>
                  <span className="flex items-center justify-between mt-2">
                    <span className="font-bold text-foreground">£{pass.price}</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  </span>
                </button>
              );
            })}
          </div>

          {passes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Your active passes</p>
              {passes.map((p) => {
                const label = ADULT_PASSES[p.pass_type as AdultPassType]?.label ?? "Class Pass";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {p.sessions_remaining} of {p.sessions_total} classes left · valid until {format(parseISO(p.expires_at), "d MMM yyyy")}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => startRedeem("pass", p)}>
                      Book classes
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {birthdayEligible && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-foreground">Happy birthday! 🎂</span>
                  <span className="block text-[10px] text-muted-foreground">
                    One free class, valid for {BIRTHDAY_CLASS_WINDOW_DAYS} days from your birthday.
                  </span>
                </div>
              </div>
              <Button size="sm" className="text-xs bg-green-500 hover:bg-green-600 text-white" onClick={() => startRedeem("birthday")}>
                Claim free class
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session picker for pass / birthday redemption */}
      <PassRedeemDialog
        open={!!redeeming}
        onOpenChange={(o) => { if (!o) setRedeeming(null); }}
        mode={redeeming?.mode ?? "pass"}
        pass={redeeming?.pass ?? null}
        sessionOptions={sessionOptions}
        onRedeemed={() => {
          fetchPasses();
          onRedeemed?.();
        }}
      />
    </>
  );
}
