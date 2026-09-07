import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";
import { formatPrice } from "@/lib/bookingFormat";
import {
  BIRTHDAY_CLASS_WINDOW_DAYS,
  BIRTHDAY_CLASS_EARLY_DAYS,
} from "@/lib/pricing";
import { passLabelOf, usePassCatalog, type PassDef } from "@/lib/passCatalog";
import { passCoverageLabel } from "@/lib/passEligibility";

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

// The sale list now comes from the studio's own pass catalogue.

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

const daysUntilNextBirthday = (dob: string): number | null => {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisYear = Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  const next = thisYear >= todayUTC
    ? thisYear
    : Date.UTC(now.getUTCFullYear() + 1, birth.getUTCMonth(), birth.getUTCDate());
  return Math.round((next - todayUTC) / 86400000);
};

/** Adult multi-class passes: buy 2/4/6/8-class bundles, redeem them against
 *  any adult classes, and claim the free birthday class. */
export function AdultPassesCard({ sessionOptions, selfStudent, onRedeemed }: AdultPassesCardProps) {
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [passes, setPasses] = useState<PassRow[]>([]);
  const { passes: catalog } = usePassCatalog();
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
  const birthdayCountdown = selfStudent?.date_of_birth
    ? daysUntilNextBirthday(selfStudent.date_of_birth)
    : null;
  // Open from a week before the birthday to 10 days after, so the class in
  // their actual birthday week always qualifies.
  const birthdayEligible =
    (birthdayDays != null && birthdayDays <= BIRTHDAY_CLASS_WINDOW_DAYS) ||
    (birthdayCountdown != null && birthdayCountdown <= BIRTHDAY_CLASS_EARLY_DAYS);

  const buyPass = (pass: PassDef) => {
    if (!user) { navigate("/auth"); return; }
    const type = pass.code;
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
      <section className="surface p-5 sm:p-6" aria-label="Class passes">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Class passes</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Mix and match any adult classes — each pass shows how many classes it
          covers and how long you have to use them.
        </p>

        {catalog.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.map((pass) => {
              const type = pass.code;
              const coverage = (pass.durations.length > 0 || pass.classIds.length > 0)
                ? `${passCoverageLabel({ durations: pass.durations, classIds: pass.classIds })} only`
                : null;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => buyPass(pass)}
                  className="pressable flex flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                >
                  <span className="text-[15px] font-semibold text-foreground">{pass.label}</span>
                  <span className="mt-1 text-[13px] leading-snug text-muted-foreground">{pass.description}</span>
                  {coverage && <span className="mt-1 text-[13px] text-muted-foreground">{coverage}</span>}
                  <span className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[17px] font-semibold tabular-nums text-foreground">{formatPrice(pass.price, { trimZeros: true })}</span>
                    <span className="text-[13px] font-medium text-primary">Add to basket</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {passes.length > 0 && (
          <div className="mt-5 border-t border-border/70 pt-5">
            <p className="text-[13px] font-medium text-muted-foreground">Your active passes</p>
            <div className="mt-2 space-y-2">
              {passes.map((p) => {
                const label = passLabelOf(catalog, p.pass_type);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-accent/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-foreground">{label}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {p.sessions_remaining} of {p.sessions_total} classes left · valid until {format(parseISO(p.expires_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <Button variant="soft" className="h-11 shrink-0 rounded-full px-5" onClick={() => startRedeem("pass", p)}>
                      Book classes
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {birthdayEligible && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">
                {birthdayDays != null && birthdayDays <= BIRTHDAY_CLASS_WINDOW_DAYS ? "Happy birthday! 🎂" : "Birthday coming up! 🎂"}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                One free class on us — claim from {BIRTHDAY_CLASS_EARLY_DAYS} days before your
                birthday to {BIRTHDAY_CLASS_WINDOW_DAYS} days after.
              </p>
            </div>
            <Button variant="ink" className="h-11 shrink-0 rounded-full px-5" onClick={() => startRedeem("birthday")}>
              Claim free class
            </Button>
          </div>
        )}
      </section>

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
