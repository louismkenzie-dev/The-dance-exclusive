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
import { useCart, type PricingPlan } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShieldCheck, Lock, Loader2, ChevronDown, Tag, X, UserPlus } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { FadeRise } from "@/components/motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const planLabel: Record<PricingPlan, string> = {
  trial: "Free trial",
  session: "Per session",
  monthly: "Monthly",
  term: "Full term",
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
  // Read the page's actual theme tokens so the Stripe iframe inherits whatever
  // route theme is active (light "Studio Light" by default here).
  const bg = cssVar("--background") || "hsl(220 25% 97%)";
  const card = cssVar("--card") || "hsl(0 0% 100%)";
  const fg = cssVar("--foreground") || "hsl(220 40% 13%)";
  const muted = cssVar("--muted-foreground") || "hsl(220 10% 45%)";
  const border = cssVar("--border") || "hsl(220 15% 88%)";
  const primary = cssVar("--primary") || "hsl(201 70% 50%)";
  const destructive = cssVar("--destructive") || "hsl(0 72% 51%)";

  return {
    theme: "stripe",
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
      borderRadius: "14px",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const returnUrl = `${origin}/checkout/return`;

    // `redirect: "if_required"` lets card payments complete inline without
    // a redirect (so we navigate manually) while still allowing Klarna /
    // Revolut / Amazon Pay etc. to redirect away when they need to.
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
        <p className="eyebrow mb-3">Contact</p>
        <LinkAuthenticationElement
          options={{ defaultValues: { email: customerEmail || "" } }}
          onChange={(e) => setEmail(e.value.email)}
        />
      </div>

      <div>
        <p className="eyebrow mb-3">Payment method</p>
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

      <Button
        type="submit"
        size="lg"
        disabled={!stripe || !elements || submitting}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…
          </>
        ) : (
          <>Pay £{totalAmount.toFixed(2)}</>
        )}
      </Button>

      <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Secure payment
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

  const finalTotal = Math.max(0, totalAmount - (coupon?.discountAmount || 0));

  useEffect(() => {
    if (!isHydrating && items.length === 0) navigate("/classes/children");
  }, [isHydrating, items.length, navigate]);

  // Recreate the PaymentIntent whenever the cart or applied coupon changes.
  useEffect(() => {
    if (isHydrating || items.length === 0) return;
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
                classId: item.classId,
                className: item.className,
                classType: item.classType,
                studentId: item.studentId,
                studentName: item.studentName,
                pricingPlan: item.pricingPlan,
                totalPrice: item.totalPrice,
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
  }, [isHydrating, items, user, profile, coupon]);

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
            totalPrice: item.totalPrice,
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

        <FadeRise className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
            Checkout
          </h1>
          <p className="text-muted-foreground mt-1">
            Review your booking{items.length > 1 ? "s" : ""} and complete your
            secure payment below.
          </p>
        </FadeRise>

        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
          {/* Payment form */}
          <FadeRise className="order-2 lg:order-1" delay={120}>
            <div className="rounded-3xl overflow-hidden bg-card shadow-soft">
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
          </FadeRise>

          {/* Order summary */}
          <FadeRise as="aside" className="order-1 lg:order-2" delay={60}>
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
                    <div className="rounded-3xl bg-card shadow-soft overflow-hidden">
                      <CollapsibleTrigger className="group w-full p-5 flex items-center justify-between gap-3 text-left hover:bg-secondary/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-semibold text-foreground">
                            Order summary
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {summaryParts.join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-display font-bold tabular-nums text-foreground">
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
                          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 border-t border-border/50 pt-4">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="pb-3 border-b border-border/50 last:border-0 last:pb-0"
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
                                  <span className="font-semibold text-sm tabular-nums text-foreground whitespace-nowrap">
                                    £{item.totalPrice.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>

                      <div className="px-5 py-4 border-t border-border/50 space-y-2 bg-secondary/40">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Subtotal</span>
                          <span className="tabular-nums">£{totalAmount.toFixed(2)}</span>
                        </div>
                        {coupon && (
                          <div className="flex items-center justify-between text-sm text-primary">
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" /> Discount ({coupon.code})
                            </span>
                            <span className="tabular-nums">-£{coupon.discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            Total
                          </span>
                          <span className="text-2xl font-display font-bold tabular-nums text-foreground">
                            £{finalTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Collapsible>

              {/* Coupon code */}
              <div className="rounded-3xl bg-card shadow-soft p-4">
                {coupon ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground font-mono truncate">{coupon.code}</p>
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
                    <p className="eyebrow">Have a coupon?</p>
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
          </FadeRise>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
