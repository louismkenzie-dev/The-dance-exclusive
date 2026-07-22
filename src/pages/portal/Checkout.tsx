import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCart, cartItemKind, type CartItem, type PricingPlan } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ShieldCheck, Lock, Loader2, ChevronDown, Tag, X, UserPlus, Users } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TERMS_AND_CONDITIONS } from "@/lib/terms";
import {
  MONTHLY_PAYMENT_INFO,
  additionalMonthlyPrice,
  computeSiblingDiscount,
  monthlyPrice,
  priceMonthlyItems,
  round2,
} from "@/lib/pricing";

const planLabel: Record<PricingPlan, string> = {
  trial: "Trial",
  session: "Per Session",
  monthly: "Monthly Membership",
  term: "Full Term",
  yearly: "Full Year",
  pass: "Class Pass",
};

/**
 * Read a CSS HSL variable from :root and convert to "hsl(...)" string Stripe accepts.
 */
function cssVar(name: string): string {
  if (typeof window === "undefined") return "";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw})` : "";
}

function buildAppearance(): Appearance {
  const bg = cssVar("--background") || "hsl(220 20% 4%)";
  const card = cssVar("--card") || "hsl(220 18% 8%)";
  const fg = cssVar("--foreground") || "hsl(0 0% 98%)";
  const muted = cssVar("--muted-foreground") || "hsl(220 10% 55%)";
  const border = cssVar("--border") || "hsl(220 15% 16%)";
  const primary = cssVar("--primary") || "hsl(193 100% 44%)";
  const destructive = cssVar("--destructive") || "hsl(0 72% 51%)";

  return {
    theme: "night",
    labels: "floating",
    variables: {
      colorPrimary: primary,
      colorBackground: card,
      colorText: fg,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: destructive,
      colorIcon: muted,
      colorIconHover: fg,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSizeBase: "15px",
      borderRadius: "8px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: fg,
        boxShadow: "none",
        padding: "12px 14px",
      },
      ".Input:focus": {
        border: `1px solid ${primary}`,
        boxShadow: `0 0 0 1px ${primary}`,
      },
      ".Input--invalid": {
        border: `1px solid ${destructive}`,
        boxShadow: "none",
      },
      ".Label": {
        color: muted,
        fontWeight: "500",
        fontSize: "13px",
        letterSpacing: "0.02em",
      },
      ".Tab": {
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: fg,
        padding: "12px 14px",
      },
      ".Tab:hover": {
        backgroundColor: card,
        color: fg,
      },
      ".Tab--selected": {
        backgroundColor: card,
        border: `1px solid ${primary}`,
        color: fg,
        boxShadow: `0 0 0 1px ${primary}`,
      },
      ".TabIcon--selected": {
        fill: primary,
      },
      ".TabLabel--selected": {
        color: fg,
      },
      ".Block": {
        backgroundColor: card,
        border: `1px solid ${border}`,
      },
      ".AccordionItem": {
        backgroundColor: bg,
        border: `1px solid ${border}`,
      },
      ".AccordionItem--selected": {
        border: `1px solid ${primary}`,
        boxShadow: `0 0 0 1px ${primary}`,
      },
      ".CheckboxInput": {
        backgroundColor: bg,
        border: `1px solid ${border}`,
      },
      ".CheckboxInput--checked": {
        backgroundColor: primary,
      },
      ".Error": {
        color: destructive,
        fontSize: "13px",
      },
      ".RedirectText": {
        color: muted,
      },
    },
  };
}

const PaymentForm = ({
  totalAmount,
  customerEmail,
}: {
  totalAmount: number;
  customerEmail?: string | null;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(customerEmail || "");
  // Mandatory Terms & Conditions acceptance before payment.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!termsAccepted) {
      setError("Please confirm you have read and accepted the Terms & Conditions.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const returnUrl = `${origin}/checkout/return`;

    // `redirect: "if_required"` lets card payments complete inline without a
    // redirect (so we navigate manually). Payment methods are card + wallets
    // only — Klarna and other BNPL methods are disabled server-side.
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        receipt_email: email || undefined,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent) {
      // Inline success (card / wallet) — clear the basket at the moment of
      // known success (the return page also clears, but must not be the only
      // place: if it fails to load, the paid items would linger and trigger
      // the duplicate-booking guard on the next checkout).
      if (paymentIntent.status === "succeeded") {
        clearCart();
      }
      window.location.assign(
        `${returnUrl}?payment_intent=${paymentIntent.id}` +
          `&payment_intent_client_secret=${paymentIntent.client_secret}` +
          `&redirect_status=${paymentIntent.status === "succeeded" ? "succeeded" : "processing"}`,
      );
    }
    // Otherwise Stripe is mid-redirect — do nothing.
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Contact
        </p>
        <LinkAuthenticationElement
          options={{ defaultValues: { email: customerEmail || "" } }}
          onChange={(e) => setEmail(e.value.email)}
        />
      </div>

      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Payment method
        </p>
        <PaymentElement
          options={{
            layout: { type: "tabs", defaultCollapsed: false },
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mandatory T&C acceptance */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-background/50">
        <Checkbox
          id="accept-terms"
          checked={termsAccepted}
          onCheckedChange={(v) => {
            setTermsAccepted(v === true);
            if (v === true) setError(null);
          }}
          className="mt-0.5"
        />
        <label htmlFor="accept-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
          I confirm I have read and accept The Dance Exclusive's{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            Terms &amp; Conditions
          </button>
          .
        </label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!stripe || !elements || submitting || !termsAccepted}
        className="w-full font-bold uppercase tracking-wider"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…
          </>
        ) : (
          <>Pay £{totalAmount.toFixed(2)}</>
        )}
      </Button>

      {/* Full T&C text */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terms and Conditions — The Dance Exclusive</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            By enrolling in any class, workshop, or program with The Dance Exclusive,
            you agree to the following terms and conditions:
          </p>
          <div className="space-y-4">
            {TERMS_AND_CONDITIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{section.title}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {section.points.map((point, i) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed">{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Secure Payment
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Powered by Stripe
        </span>
      </div>
    </form>
  );
};

interface AppliedCoupon {
  couponId: string;
  code: string;
  discountAmount: number;
}

const CheckoutPage = () => {
  const { items, totalAmount, isHydrating } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  // Attendee-profile errors get an actionable "Add attendee details" button.
  const needsProfile = !!initError && /attendee profile|arrival\/departure|profile is missing|attendee's profile/i.test(initError);

  // Coupon state
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  // Pricing context needed to mirror the server's checkout maths: class rows
  // (durations + sibling flags), camp sibling flags, which attendees are the
  // account holder vs children, and whether another child already has a booking.
  interface PricingContext {
    classes: Map<string, { class_type: "children" | "adult"; start_time: string | null; end_time: string | null; price_per_session: number | null; price_per_term: number | null; price_per_month: number | null; price_per_year: number | null; sibling_discount_enabled: boolean }>;
    camps: Map<string, { sibling_discount_enabled: boolean }>;
    selfIds: Set<string>;
    priorBookedChildIds: string[];
  }
  const [pricingCtx, setPricingCtx] = useState<PricingContext | null>(null);

  const itemsKey = useMemo(
    () => items.map((i) => `${i.id}:${i.pricingPlan}:${i.totalPrice}`).join("|"),
    [items],
  );

  useEffect(() => {
    if (isHydrating || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const classIds = [...new Set(items.filter((i) => cartItemKind(i) === "class" && i.classId).map((i) => i.classId as string))];
      const campIds = [...new Set(items.filter((i) => cartItemKind(i) === "camp" && i.campId).map((i) => i.campId as string))];
      const [classRes, campRes, studentsRes, bookingsRes] = await Promise.all([
        classIds.length
          ? supabase.from("classes").select("id, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, sibling_discount_enabled").in("id", classIds)
          : Promise.resolve({ data: [] as any[] }),
        campIds.length
          ? supabase.from("camps").select("id, sibling_discount_enabled").in("id", campIds)
          : Promise.resolve({ data: [] as any[] }),
        user?.id
          ? supabase.from("students").select("id, is_self").eq("parent_id", user.id)
          : Promise.resolve({ data: [] as any[] }),
        user?.id
          ? supabase.from("bookings").select("student_id").eq("parent_id", user.id).eq("status", "confirmed").not("student_id", "is", null)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const selfIds = new Set(((studentsRes.data as any[]) ?? []).filter((s) => s.is_self).map((s) => s.id as string));
      const priorBookedChildIds = [...new Set(
        (((bookingsRes.data as any[]) ?? [])
          .map((b) => b.student_id as string)
          .filter((id) => id && !selfIds.has(id))),
      )];
      setPricingCtx({
        classes: new Map(((classRes.data as any[]) ?? []).map((c) => [c.id, c])),
        camps: new Map(((campRes.data as any[]) ?? []).map((c) => [c.id, c])),
        selfIds,
        priorBookedChildIds,
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating, itemsKey, user?.id]);

  // Adjusted per-item charges: monthly memberships beyond a child's first
  // class drop to the additional-class rate (capped at the £110 Unlimited
  // price), mirroring the server's authoritative computation.
  const adjusted = useMemo(() => {
    const charges = new Map<string, number>(items.map((i) => [i.id, round2(i.totalPrice)]));
    if (pricingCtx) {
      const monthlyInputs = items
        .filter((i) => cartItemKind(i) === "class" && i.pricingPlan === "monthly" && i.classId && pricingCtx.classes.has(i.classId))
        .map((i) => {
          const cls = pricingCtx.classes.get(i.classId as string)!;
          return {
            id: i.id,
            studentId: i.studentId,
            fullMonthly: monthlyPrice(cls),
            additionalMonthly: additionalMonthlyPrice(cls),
          };
        });
      const monthlyCharges = priceMonthlyItems(monthlyInputs);
      for (const [id, amount] of monthlyCharges) charges.set(id, amount);
    }
    const adjustedSubtotal = round2([...charges.values()].reduce((s, v) => s + v, 0));
    const multiClassDiscount = round2(totalAmount - adjustedSubtotal);

    const sibling = pricingCtx
      ? computeSiblingDiscount(
        items.map((i) => {
          const kind = cartItemKind(i);
          const product = kind === "camp"
            ? pricingCtx.camps.get(i.campId ?? "")
            : pricingCtx.classes.get(i.classId ?? "");
          return {
            id: i.id,
            studentId: i.studentId,
            isSelfStudent: i.studentId ? pricingCtx.selfIds.has(i.studentId) : false,
            classType: kind === "pass" ? "adult" as const : i.classType,
            siblingDiscountEnabled: (product as any)?.sibling_discount_enabled ?? true,
            totalPrice: charges.get(i.id) ?? 0,
          };
        }),
        pricingCtx.priorBookedChildIds,
      )
      : { total: 0, perItem: new Map<string, number>(), discountedChildIds: [] as string[] };

    return { charges, adjustedSubtotal, multiClassDiscount, sibling };
  }, [items, pricingCtx, totalAmount]);

  const hasMonthlyItems = items.some((i) => i.pricingPlan === "monthly");
  const finalTotal = Math.max(
    0,
    round2(adjusted.adjustedSubtotal - adjusted.sibling.total - (coupon?.discountAmount || 0)),
  );

  useEffect(() => {
    if (!isHydrating && items.length === 0) navigate("/classes/children");
  }, [isHydrating, items.length, navigate]);

  // Recreate the PaymentIntent whenever the cart, pricing context or applied
  // coupon changes. Waits for the pricing context so the amounts sent match
  // what the server will re-compute.
  useEffect(() => {
    if (isHydrating || items.length === 0 || !pricingCtx) return;
    let cancelled = false;

    (async () => {
      setInitError(null);
      setInitializing(true);
      setClientSecret(null);
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-payment-intent",
          {
            body: {
              items: items.map((item) => ({
                itemKind: cartItemKind(item),
                classId: item.classId,
                campId: item.campId ?? null,
                passType: item.passType ?? null,
                className: item.className,
                classType: item.classType,
                studentId: item.studentId,
                studentName: item.studentName,
                pricingPlan: item.pricingPlan,
                totalPrice: adjusted.charges.get(item.id) ?? item.totalPrice,
                sessionsCount: item.sessionsCount,
                selectedSessionIds: item.selectedSessionIds ?? [],
              })),
              customerEmail: user?.email || profile?.email,
              userId: user?.id,
              environment: getStripeEnvironment(),
              couponCode: coupon?.code,
              previousPaymentIntentId: paymentIntentId,
            },
          },
        );

        if (cancelled) return;

        if (error || !data?.clientSecret) {
          // supabase-js hides the function's JSON body behind error.context —
          // surface the server's friendly message (e.g. the duplicate-booking
          // explanation from the 409 guard) instead of the generic
          // "Edge Function returned a non-2xx status code".
          let message =
            data?.error || error?.message || "Failed to initialise payment";
          const ctx = (error as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.json();
              if (body?.error) message = body.error;
            } catch {
              // keep the generic message
            }
          }
          setInitError(message);
        } else {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId || null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setInitError(e?.message || "Failed to initialise payment");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating, itemsKey, pricingCtx, user, profile, coupon]);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponSubmitting(true);
    setCouponError(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: {
          code,
          userId: user?.id,
          items: items.map((item) => ({
            classId: item.classId,
            classType: item.classType,
            pricingPlan: item.pricingPlan,
            totalPrice: adjusted.charges.get(item.id) ?? item.totalPrice,
            itemKind: cartItemKind(item),
            campId: item.campId ?? null,
          })),
        },
      });
      if (error || data?.error) {
        setCouponError(data?.error || error?.message || "Could not apply coupon");
      } else if (data?.couponId) {
        setCoupon({ couponId: data.couponId, code: data.code, discountAmount: data.discountAmount });
        setCouponInput("");
      }
    } catch (e: any) {
      setCouponError(e?.message || "Could not apply coupon");
    } finally {
      setCouponSubmitting(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null);
    setCouponError(null);
  };

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: buildAppearance(),
      loader: "auto",
      fonts: [
        {
          cssSrc:
            "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
        },
      ],
    };
  }, [clientSecret]);

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="container max-w-6xl py-16 text-center text-muted-foreground">
          Loading checkout…
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="container max-w-6xl py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 uppercase tracking-tight">
            Checkout
          </h1>
          <p className="text-sm text-muted-foreground">
            Review your booking{items.length > 1 ? "s" : ""} and complete your
            secure payment below.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
          {/* Payment form */}
          <div className="order-2 lg:order-1">
            <div className="rounded-xl overflow-hidden border border-border bg-card">
              {initializing && (
                <div className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  Preparing secure payment…
                </div>
              )}

              {initError && !initializing && (
                <div className="p-6 space-y-4">
                  <Alert variant="destructive">
                    <AlertTitle>{needsProfile ? "Attendee details needed" : "Checkout unavailable"}</AlertTitle>
                    <AlertDescription>{initError}</AlertDescription>
                  </Alert>
                  {needsProfile && (
                    <Button onClick={() => navigate("/account")} className="w-full gap-1.5">
                      <UserPlus className="w-4 h-4" /> Add attendee details
                    </Button>
                  )}
                </div>
              )}

              {clientSecret && elementsOptions && (
                <Elements stripe={getStripe()} options={elementsOptions}>
                  <PaymentForm
                    totalAmount={finalTotal}
                    customerEmail={user?.email || profile?.email}
                  />
                </Elements>
              )}
            </div>
          </div>

          {/* Order summary */}
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-32 space-y-4">
              <Collapsible defaultOpen={false}>
                {(() => {
                  const adultCount = items.filter(
                    (i) => i.classType === "adult",
                  ).length;
                  const childCount = items.length - adultCount;
                  const summaryParts: string[] = [];
                  if (childCount > 0)
                    summaryParts.push(
                      `${childCount} children's session${childCount !== 1 ? "s" : ""}`,
                    );
                  if (adultCount > 0)
                    summaryParts.push(
                      `${adultCount} adult session${adultCount !== 1 ? "s" : ""}`,
                    );

                  return (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <CollapsibleTrigger className="group w-full p-5 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Order Summary
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {summaryParts.join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-bold text-foreground">
                            £{finalTotal.toFixed(2)}
                          </span>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform",
                              "group-data-[state=open]:rotate-180",
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="px-5 pb-5">
                          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 border-t border-border pt-4">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="pb-3 border-b border-border last:border-0 last:pb-0"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm text-foreground">
                                      {item.className}{" "}
                                      <span className="text-muted-foreground font-normal text-xs">
                                        (
                                        {item.classType === "adult"
                                          ? "Adults"
                                          : "Children"}
                                        )
                                      </span>
                                    </p>
                                    {item.studentName && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        for {item.studentName}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {item.dayOfWeek.charAt(0).toUpperCase() +
                                        item.dayOfWeek.slice(1)}{" "}
                                      · {item.startTime?.slice(0, 5)}–
                                      {item.endTime?.slice(0, 5)}
                                    </p>
                                    {item.venueName && (
                                      <p className="text-xs text-muted-foreground">
                                        {item.venueName}
                                      </p>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className="mt-1.5 text-[10px]"
                                    >
                                      {planLabel[item.pricingPlan]}
                                    </Badge>
                                  </div>
                                  <span className="font-bold text-sm text-foreground whitespace-nowrap">
                                    £{(adjusted.charges.get(item.id) ?? item.totalPrice).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>

                      <div className="px-5 py-4 border-t border-border space-y-2 bg-muted/20">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Subtotal</span>
                          <span>£{totalAmount.toFixed(2)}</span>
                        </div>
                        {adjusted.multiClassDiscount > 0.005 && (
                          <div className="flex items-center justify-between text-sm text-primary">
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" /> Additional-class rate
                            </span>
                            <span>-£{adjusted.multiClassDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {adjusted.sibling.total > 0 && (
                          <div className="flex items-center justify-between text-sm text-primary">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Sibling discount (10%)
                            </span>
                            <span>-£{adjusted.sibling.total.toFixed(2)}</span>
                          </div>
                        )}
                        {coupon && (
                          <div className="flex items-center justify-between text-sm text-primary">
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" /> Discount ({coupon.code})
                            </span>
                            <span>-£{coupon.discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Total
                          </span>
                          <span className="text-2xl font-bold text-foreground">
                            £{finalTotal.toFixed(2)}
                          </span>
                        </div>
                        {hasMonthlyItems && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                            {MONTHLY_PAYMENT_INFO} Cancelling requires one month's written
                            notice to hello@thedanceexclusive.co.uk.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </Collapsible>

              {/* Coupon code */}
              <div className="rounded-xl border border-border bg-card p-4">
                {coupon ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground font-mono truncate">{coupon.code}</p>
                        <p className="text-xs text-muted-foreground">
                          Saving £{coupon.discountAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Have a coupon?
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        placeholder="Enter code"
                        className="uppercase font-mono"
                        disabled={couponSubmitting}
                      />
                      <Button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponSubmitting || !couponInput.trim()}
                      >
                        {couponSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-destructive">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                By completing your purchase you agree to our terms. Bookings
                are confirmed immediately after payment.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
