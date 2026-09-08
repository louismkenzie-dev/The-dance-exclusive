import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Appearance, StripeElementsOptions } from "@stripe/stripe-js";
import { getPaymentsEnvironment, getStripe } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCart, cartItemKind } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import CustomerAddressCard from "@/components/portal/CustomerAddressCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { TERMS_AND_CONDITIONS } from "@/lib/terms";
import { formatPrice } from "@/lib/bookingFormat";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  ResponsiveSheet,
  SectionHeading,
  Steps,
  StickyActionBar,
  StickyActionBarSpacer,
  SummarySkeleton,
  Bone,
} from "@/components/booking";
import { CheckoutSection } from "@/components/booking/CheckoutSection";
import { CheckoutSummaryCard, CheckoutSummaryStrip, type CheckoutSummaryProps, type SummaryNote } from "@/components/booking/CheckoutSummary";
import { BookingItemsSkeleton, CheckoutFormSkeleton, FieldSkeleton, PaymentFieldsSkeleton } from "@/components/booking/CheckoutSkeletons";
import { PaymentErrorNotice } from "@/components/booking/PaymentErrorNotice";
import { friendlyPaymentError } from "@/components/booking/paymentErrors";
import { planLine, scheduleLine } from "@/components/booking/checkoutItemText";
import {
  MONTHLY_PAYMENT_INFO,
  UNLIMITED_MONTHLY_CAP,
  additionalMonthlyPrice,
  additionalYearlyPrice,
  computeSiblingDiscount,
  type ExistingEnrolment,
  monthlyPrice,
  priceMonthlyItems,
  priceYearlyItems,
  round2,
  yearlyPrice,
} from "@/lib/pricing";

/** "5 September" — en-GB day + month, in studio time so the 07:00 UTC
 *  billing anchor always reads as the 5th. */
const formatFirstPayment = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });

const CHECKOUT_STEPS = ["Your booking", "Your details", "Payment"];

// ---------------------------------------------------------------------------
// Stripe appearance. The Payment Element lives in an iframe, so it cannot
// read our CSS variables — the tokens are resolved here from the themed page
// root and handed over as plain colours, and the theme flips to "night" when
// the page ground is dark (the adult portal).
// ---------------------------------------------------------------------------

/** The raw HSL triplet of a token ("193 100% 36%"), or null when unset. */
function readToken(root: Element | null, name: string): string | null {
  if (typeof window === "undefined") return null;
  const el = root ?? document.body ?? document.documentElement;
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  return raw || null;
}

const hsl = (raw: string | null, alpha?: number): string | undefined =>
  raw == null ? undefined : alpha == null ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;

/** Lightness of an HSL triplet: "36 22% 97.5%" → 97.5. */
const lightnessOf = (raw: string | null): number | null => {
  if (!raw) return null;
  const l = parseFloat(raw.split(/\s+/)[2] ?? "");
  return Number.isFinite(l) ? l : null;
};

/** Drop unset entries so Stripe never receives an empty colour. */
const compact = (o: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "")) as Record<string, string>;

function buildAppearance(root: Element | null): Appearance {
  const light = (lightnessOf(readToken(root, "--background")) ?? 100) >= 50;
  const primaryRaw = readToken(root, "--primary");
  const accentRaw = readToken(root, "--accent");
  const primary = hsl(primaryRaw);
  const card = hsl(readToken(root, "--card"));
  const fg = hsl(readToken(root, "--foreground"));
  const muted = hsl(readToken(root, "--muted-foreground"));
  const border = hsl(readToken(root, "--border"));
  const input = hsl(readToken(root, "--input"));
  const destructive = hsl(readToken(root, "--destructive"));
  // The accent is a soft tint on the light theme and a saturated brand
  // colour on the dark one — only the tint works as a selected-row fill.
  const accentFill = (lightnessOf(accentRaw) ?? 0) >= 80 ? hsl(accentRaw) : undefined;
  const focusRing = hsl(primaryRaw, 0.2);

  return {
    theme: light ? "stripe" : "night",
    labels: "above",
    variables: compact({
      colorPrimary: primary,
      colorBackground: card,
      colorText: fg,
      colorTextSecondary: muted,
      colorTextPlaceholder: muted,
      colorDanger: destructive,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      fontSizeBase: "16px",
      borderRadius: "12px",
      spacingUnit: "5px",
    }),
    rules: {
      ".Input": compact({
        border: input ? `1px solid ${input}` : undefined,
        boxShadow: "none",
        padding: "14px 16px",
      }),
      ".Input:focus": compact({
        borderColor: primary,
        boxShadow: focusRing ? `0 0 0 3px ${focusRing}` : undefined,
      }),
      ".Input--invalid": compact({
        borderColor: destructive,
        boxShadow: "none",
      }),
      ".Label": {
        fontWeight: "500",
        fontSize: "13px",
      },
      ".Tab": compact({
        border: border ? `1px solid ${border}` : undefined,
        borderRadius: "12px",
      }),
      ".AccordionItem": compact({
        border: border ? `1px solid ${border}` : undefined,
        borderRadius: "12px",
      }),
      ".AccordionItem--selected": compact({
        borderColor: primary,
        backgroundColor: accentFill,
      }),
      ".Error": {
        fontSize: "13px",
      },
    },
  };
}

const PaymentForm = ({
  totalAmount,
  customerEmail,
  clientSecret,
  subscriptionId,
  userId,
  onAddressValidChange,
}: {
  totalAmount: number;
  customerEmail?: string | null;
  clientSecret: string;
  subscriptionId?: string | null;
  userId?: string | null;
  /** Mirrors the address gate to the page, purely for the step indicator. */
  onAddressValidChange?: (valid: boolean) => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  // August membership signups save a card via SetupIntent — nothing is
  // charged today, so the confirm step and button copy differ.
  const setupMode = clientSecret.startsWith("seti_");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(customerEmail || "");
  // Mandatory Terms & Conditions acceptance before payment.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  // Home address is required before any booking is taken.
  const [addressValid, setAddressValid] = useState(false);
  // Skeletons stand in for the Stripe iframes until they draw themselves.
  const [emailReady, setEmailReady] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState<string | null>(null);

  // The skeletons sit above the Stripe iframes and never hide them, so a
  // missed ready event cannot block paying; this just stops a skeleton
  // lingering above a form that has plainly drawn itself.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setEmailReady(true);
      setPaymentReady(true);
    }, 8000);
    return () => window.clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!addressValid) {
      setError("Please add and save your home address before paying.");
      return;
    }
    if (!termsAccepted) {
      setError("Please confirm you have read and accepted the Terms & Conditions.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const returnUrl = `${origin}/checkout/return`;

    if (setupMode) {
      // £0-today path: confirm the SetupIntent (card saved, first charge on
      // the subscription's trial end). Stripe appends setup_intent params to
      // the return_url on a redirect; the inline path mirrors them below.
      const setupReturnUrl = `${returnUrl}?subscription=${subscriptionId ?? ""}`;
      const { error: submitError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: setupReturnUrl },
        redirect: "if_required",
      });

      if (submitError) {
        setError(submitError.message || "Card setup failed. Please try again.");
        setSubmitting(false);
        return;
      }

      if (setupIntent) {
        if (setupIntent.status === "succeeded") {
          // Activate the membership (bookings + email) before leaving the
          // page. The return page and the daily maintenance job both retry
          // this idempotently, so a transient failure must not block success.
          try {
            await supabase.functions.invoke("finalize-membership-setup", {
              body: { subscriptionId },
            });
          } catch {
            // return page / maintenance job complete the activation
          }
          clearCart();
        }
        window.location.assign(
          `${setupReturnUrl}&setup_intent=${setupIntent.id}` +
            `&setup_intent_client_secret=${setupIntent.client_secret}` +
            `&redirect_status=${setupIntent.status === "succeeded" ? "succeeded" : "processing"}`,
        );
      }
      // Otherwise Stripe is mid-redirect — do nothing.
      return;
    }

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

  const friendly = error ? friendlyPaymentError(error) : null;
  const payDisabled = !stripe || !elements || submitting || !termsAccepted || !addressValid;
  const payLabel = submitting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
    </>
  ) : setupMode ? (
    "Set up membership · £0 today"
  ) : (
    `Pay ${formatPrice(totalAmount)}`
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <CheckoutSection step={2} title="Your details">
        <div>
          {!emailReady && <FieldSkeleton labelWidth="w-12" />}
          <LinkAuthenticationElement
            options={{ defaultValues: { email: customerEmail || "" } }}
            onChange={(e) => setEmail(e.value.email)}
            onLoaderStart={() => setEmailReady(true)}
            onReady={() => setEmailReady(true)}
          />
        </div>

        {userId && (
          <CustomerAddressCard
            userId={userId}
            onValidChange={(valid) => {
              setAddressValid(valid);
              onAddressValidChange?.(valid);
            }}
          />
        )}
      </CheckoutSection>

      <CheckoutSection step={3} title="Payment">
        <div>
          {!paymentReady && !paymentLoadError && <PaymentFieldsSkeleton />}
          {paymentLoadError && (
            <PaymentErrorNotice
              title="The payment form couldn't load"
              body="Refresh the page to try again — nothing has been charged."
              detail={paymentLoadError}
            />
          )}
          <PaymentElement
            options={{
              layout: { type: "accordion", defaultCollapsed: false, radios: "always", spacedAccordionItems: true },
            }}
            onLoaderStart={() => setPaymentReady(true)}
            onReady={() => setPaymentReady(true)}
            onLoadError={(e) => setPaymentLoadError(e.error?.message || "Stripe could not load the payment form.")}
          />
        </div>

        {friendly && <PaymentErrorNotice title={friendly.title} body={friendly.body} detail={friendly.detail} />}

        {/* Mandatory T&C acceptance */}
        <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3.5">
          <Checkbox
            id="accept-terms"
            checked={termsAccepted}
            onCheckedChange={(v) => {
              setTermsAccepted(v === true);
              if (v === true) setError(null);
            }}
            className="mt-0.5 h-5 w-5 rounded-md"
          />
          <label htmlFor="accept-terms" className="cursor-pointer text-sm leading-relaxed text-foreground">
            I have read and accept The Dance Exclusive's{" "}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
              className="rounded-sm font-medium text-primary underline underline-offset-4 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              terms and conditions
            </button>
            .
          </label>
        </div>

        {/* Wide screens: the action sits under the terms. Phones get the
            sticky bar below instead — never both. */}
        <Button type="submit" size="xl" disabled={payDisabled} className="hidden w-full md:inline-flex">
          {payLabel}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Secure payment · Powered by Stripe
        </p>
      </CheckoutSection>

      <StickyActionBar
        action={
          <Button type="submit" size="xl" disabled={payDisabled} className="px-4">
            {payLabel}
          </Button>
        }
      >
        <p className="text-[13px] leading-tight text-muted-foreground">Total</p>
        <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">{formatPrice(totalAmount)}</p>
        {setupMode && <p className="text-[13px] font-medium leading-tight text-primary">Nothing to pay today</p>}
      </StickyActionBar>

      {/* Full T&C text */}
      <ResponsiveSheet
        open={termsOpen}
        onOpenChange={setTermsOpen}
        title="Terms and conditions"
        description="The Dance Exclusive"
        size="lg"
        themeClass="portal-ui"
        footer={
          <Button type="button" variant="soft" onClick={() => setTermsOpen(false)} className="h-12 w-full rounded-xl text-[15px] font-semibold">
            Close
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          By enrolling in any class, workshop, or program with The Dance Exclusive,
          you agree to the following terms and conditions:
        </p>
        <div className="mt-5 space-y-6">
          {TERMS_AND_CONDITIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-[15px] font-semibold text-foreground">{section.title}</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {section.points.map((point, i) => (
                  <li key={i} className="text-sm leading-relaxed text-muted-foreground">{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ResponsiveSheet>
    </form>
  );
};

interface AppliedCoupon {
  couponId: string;
  code: string;
  discountAmount: number;
}

/** Page chrome shared by the loading skeleton and the real page. */
const CheckoutShell = ({
  rootRef,
  classesPath,
  stepIndex,
  children,
}: {
  rootRef?: RefObject<HTMLDivElement>;
  classesPath: string;
  stepIndex: number;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  return (
  <div ref={rootRef} className="min-h-screen bg-background">
    <PaymentTestModeBanner />
    <div className="container max-w-6xl pb-10 pt-4 sm:pt-6">
      {/* Goes back to wherever the parent came from (the class, the list, the
          basket), exactly as before; the classes path is only the fallback
          when there is no history to return to. */}
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(classesPath))}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      <SectionHeading
        as="h1"
        size="page"
        title="Checkout"
        subtitle="Check your booking, confirm your details and pay securely."
        className="mt-2"
      />
      <Steps steps={CHECKOUT_STEPS} current={stepIndex} className="mt-6" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-10">
        {children}
      </div>
      <StickyActionBarSpacer />
    </div>
  </div>
  );
};

const CheckoutPage = () => {
  const { items, totalAmount, isHydrating, setIsOpen } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  // August £0-today signups: card saved via SetupIntent, first charge on the
  // 5th of next month. Populated from the create-payment-intent response.
  const [setupMode, setSetupMode] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [firstPaymentDate, setFirstPaymentDate] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initErrorCode, setInitErrorCode] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  // Bumped when the family fixes what the server complained about, so the
  // payment intent is created again without a page reload.
  const [retryKey, setRetryKey] = useState(0);
  // Belt and braces: never let a server that keeps refusing turn the retry
  // into a hot loop against Stripe.
  const contactRetries = useRef(0);
  // Attendee-profile errors get an actionable "Add attendee details" button.
  const needsProfile = !!initError && /attendee profile|arrival\/departure|profile is missing|attendee's profile/i.test(initError);
  // The server won't quote a price until we hold a home address and phone —
  // and the form that collects them lives inside the payment form, which
  // never renders while the server is refusing. Show it here instead so the
  // family can fix it in place rather than hitting a dead end.
  const needsContactDetails =
    initErrorCode === "address_required" || initErrorCode === "phone_required";

  // Coupon state
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  // Presentation only: the page root (for resolving theme tokens into the
  // Stripe appearance), the one-column/two-column switch, and whether the
  // address is on file (for the step indicator).
  const pageRef = useRef<HTMLDivElement>(null);
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [addressComplete, setAddressComplete] = useState<boolean | null>(null);

  // Pricing context needed to mirror the server's checkout maths: class rows
  // (durations + sibling flags), camp sibling flags, which attendees are the
  // account holder vs children, and whether another child already has a booking.
  interface PricingContext {
    classes: Map<string, { class_type: "children" | "adult"; start_time: string | null; end_time: string | null; price_per_session: number | null; price_per_term: number | null; price_per_month: number | null; price_per_year: number | null; sibling_discount_enabled: boolean }>;
    camps: Map<string, { sibling_discount_enabled: boolean }>;
    selfIds: Set<string>;
    priorBookedChildIds: string[];
    /** Live monthly memberships each child already holds (cross-checkout
     *  additional-class rate + £110 cap) — mirrors the server's query. */
    existingMonthlyByStudent: Map<string, ExistingEnrolment>;
    /** Confirmed pay-yearly bookings per child this dance year. */
    existingYearlyByStudent: Map<string, number>;
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
      const [classRes, campRes, studentsRes, bookingsRes, envRes] = await Promise.all([
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
        user?.id ? getPaymentsEnvironment().catch(() => "live") : Promise.resolve("live"),
      ]);
      // Cross-checkout multi-class discount inputs — the same queries the
      // server runs, over this parent's own rows.
      const paymentsEnv = envRes as string;
      const [membershipsRes, yearlyRes] = user?.id
        ? await Promise.all([
          supabase
            .from("memberships")
            .select("student_id, monthly_amount")
            .eq("user_id", user.id)
            .eq("stripe_env", paymentsEnv)
            .in("status", ["active", "paused", "past_due", "cancel_scheduled"]),
          (() => {
            const now = new Date();
            const y = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
            return supabase
              .from("bookings")
              .select("student_id")
              .eq("parent_id", user.id)
              .eq("booking_type", "yearly")
              .eq("status", "confirmed")
              .gte("booked_at", `${y}-08-01`);
          })(),
        ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      if (cancelled) return;
      const selfIds = new Set(((studentsRes.data as any[]) ?? []).filter((s) => s.is_self).map((s) => s.id as string));
      const priorBookedChildIds = [...new Set(
        (((bookingsRes.data as any[]) ?? [])
          .map((b) => b.student_id as string)
          .filter((id) => id && !selfIds.has(id))),
      )];
      const existingMonthlyByStudent = new Map<string, ExistingEnrolment>();
      for (const r of (membershipsRes.data as any[]) ?? []) {
        if (!r.student_id) continue;
        const g = existingMonthlyByStudent.get(r.student_id) ?? { count: 0, monthlyTotal: 0 };
        g.count += 1;
        g.monthlyTotal = round2(g.monthlyTotal + Number(r.monthly_amount || 0));
        existingMonthlyByStudent.set(r.student_id, g);
      }
      const existingYearlyByStudent = new Map<string, number>();
      for (const r of (yearlyRes.data as any[]) ?? []) {
        if (!r.student_id) continue;
        existingYearlyByStudent.set(r.student_id, (existingYearlyByStudent.get(r.student_id) ?? 0) + 1);
      }
      setPricingCtx({
        classes: new Map(((classRes.data as any[]) ?? []).map((c) => [c.id, c])),
        camps: new Map(((campRes.data as any[]) ?? []).map((c) => [c.id, c])),
        selfIds,
        priorBookedChildIds,
        existingMonthlyByStudent,
        existingYearlyByStudent,
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
            classId: i.classId as string,
            studentId: i.studentId,
            fullMonthly: monthlyPrice(cls),
            additionalMonthly: additionalMonthlyPrice(cls),
          };
        });
      const monthlyCharges = priceMonthlyItems(monthlyInputs, pricingCtx.existingMonthlyByStudent);
      for (const [id, amount] of monthlyCharges) charges.set(id, amount);

      // Pay-yearly gets the same additional-class treatment (no cap).
      const yearlyInputs = items
        .filter((i) => cartItemKind(i) === "class" && i.pricingPlan === "yearly" && i.classId && pricingCtx.classes.has(i.classId))
        .map((i) => {
          const cls = pricingCtx.classes.get(i.classId as string)!;
          return {
            id: i.id,
            classId: i.classId as string,
            studentId: i.studentId,
            fullYearly: yearlyPrice(cls),
            additionalYearly: additionalYearlyPrice(cls),
          };
        });
      const yearlyCharges = priceYearlyItems(yearlyInputs, pricingCtx.existingYearlyByStudent);
      for (const [id, amount] of yearlyCharges) charges.set(id, amount);
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
  // £110 Unlimited marketing: true when any child's monthly memberships in
  // this basket already sum to the cap (extra classes are then free).
  const capReachedForChild = useMemo(() => {
    const byChild = new Map<string, number>();
    for (const i of items) {
      if (i.pricingPlan !== "monthly" || i.classType !== "children" || !i.studentId) continue;
      // Memberships the child already holds count towards the cap too.
      const base = byChild.get(i.studentId)
        ?? pricingCtx?.existingMonthlyByStudent.get(i.studentId)?.monthlyTotal
        ?? 0;
      byChild.set(i.studentId, base + (adjusted.charges.get(i.id) ?? i.totalPrice));
    }
    return [...byChild.values()].some((total) => total >= UNLIMITED_MONTHLY_CAP - 0.005);
  }, [items, adjusted, pricingCtx]);
  // Client estimate for instant feedback; replaced by the server's authoritative
  // amount once the PaymentIntent is created.
  const estimatedTotal = Math.max(
    0,
    round2(adjusted.adjustedSubtotal - adjusted.sibling.total - (coupon?.discountAmount || 0)),
  );
  const finalTotal = serverTotal ?? estimatedTotal;

  useEffect(() => {
    if (!isHydrating && items.length === 0) navigate("/classes/children");
  }, [isHydrating, items.length, navigate]);

  // Recreate the PaymentIntent whenever the cart, pricing context or applied
  // coupon changes. Waits for the pricing context so the amounts sent match
  // what the server will re-compute.
  //
  // Every request here creates a fresh Stripe subscription when the basket
  // holds a membership, so it must run once per real change and never
  // because a context object was rebuilt. The effect keys on the values it
  // actually sends (not on the user/profile objects), and a request whose
  // body is identical to the one that produced the current PaymentIntent is
  // skipped outright.
  const lastIntentRequest = useRef<string | null>(null);
  const intentInFlight = useRef(false);
  const intentRequestKey = [
    itemsKey,
    items.map((i) => adjusted.charges.get(i.id) ?? i.totalPrice).join(","),
    user?.email || profile?.email || "",
    user?.id || "",
    coupon?.code || "",
    retryKey,
  ].join("§");
  useEffect(() => {
    if (isHydrating || items.length === 0 || !pricingCtx) return;
    if (lastIntentRequest.current === intentRequestKey && (clientSecret || intentInFlight.current)) return;
    lastIntentRequest.current = intentRequestKey;
    intentInFlight.current = true;
    let cancelled = false;

    (async () => {
      setInitError(null);
      setInitErrorCode(null);
      setInitializing(true);
      setClientSecret(null);
      setServerTotal(null);
      setSetupMode(false);
      setSubscriptionId(null);
      setFirstPaymentDate(null);
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
          let code: string | null = data?.code ?? null;
          const ctx = (error as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.json();
              if (body?.error) message = body.error;
              if (body?.code) code = body.code;
            } catch {
              // keep the generic message
            }
          }
          setInitError(message);
          setInitErrorCode(code);
        } else if (
          data.environment &&
          data.environment !== (await getPaymentsEnvironment().catch(() => data.environment))
        ) {
          // The server just switched Stripe environments (e.g. go-live) and
          // this page still holds the old configuration — a confirm would be
          // doomed, so ask for a refresh instead.
          setInitError("Payments were just updated — please refresh the page and try again.");
        } else {
          setClientSecret(data.clientSecret);
          // In setup mode this stores the seti_ id — the server safely
          // ignores it when it comes back as previousPaymentIntentId.
          setPaymentIntentId(data.paymentIntentId || data.setupIntentId || null);
          setSetupMode(!!data.setupMode);
          setSubscriptionId(data.subscriptionId ?? null);
          setFirstPaymentDate(data.firstPaymentDate ?? null);
          // The server's amount is authoritative — display it so the "Pay"
          // button and total always match exactly what Stripe will charge,
          // even if the client's sibling/coupon estimate drifts slightly.
          if (typeof data.amount === "number") setServerTotal(data.amount / 100);
        }
      } catch (e: any) {
        if (!cancelled) {
          setInitError(e?.message || "Failed to initialise payment");
          lastIntentRequest.current = null;
        }
      } finally {
        intentInFlight.current = false;
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating, intentRequestKey, pricingCtx]);

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
      appearance: buildAppearance(pageRef.current),
      loader: "auto",
      fonts: [
        {
          cssSrc:
            "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
        },
      ],
    };
  }, [clientSecret]);

  // ---- presentation ------------------------------------------------------

  const classesPath = (profile as { customer_type?: string | null } | null)?.customer_type === "adult_dancer"
    ? "/classes/adult"
    : "/classes/children";
  const stepIndex = needsContactDetails || addressComplete === false ? 1 : 2;

  if (isHydrating) {
    return (
      <CheckoutShell classesPath={classesPath} stepIndex={stepIndex}>
        <Bone className="h-14 w-full rounded-2xl lg:hidden" />
        <div className="min-w-0 space-y-6">
          <BookingItemsSkeleton />
          <CheckoutFormSkeleton />
        </div>
        <div className="hidden lg:block">
          <SummarySkeleton />
        </div>
      </CheckoutShell>
    );
  }

  if (items.length === 0) return null;

  const notes: SummaryNote[] = [];
  if (setupMode && firstPaymentDate) {
    notes.push({
      key: "setup",
      emphasis: true,
      text: `Nothing to pay today — your first payment of ${formatPrice(estimatedTotal)} is taken on ${formatFirstPayment(firstPaymentDate)}.`,
    });
  }
  if (capReachedForChild) {
    notes.push({ key: "cap", emphasis: true, text: "£110 cap reached — every extra class for this child is free." });
  }
  if (hasMonthlyItems) {
    notes.push({
      key: "monthly",
      text: `${MONTHLY_PAYMENT_INFO} Cancelling requires one month's written notice to hello@thedanceexclusive.co.uk.`,
    });
  }

  const summaryProps: CheckoutSummaryProps = {
    items,
    charges: adjusted.charges,
    totals: {
      subtotal: totalAmount,
      multiClassDiscount: adjusted.multiClassDiscount,
      siblingDiscount: adjusted.sibling.total,
      coupon,
      total: finalTotal,
    },
    notes,
    coupon: {
      applied: coupon,
      input: couponInput,
      onInputChange: (value) => {
        setCouponInput(value.toUpperCase());
        setCouponError(null);
      },
      error: couponError,
      submitting: couponSubmitting,
      onApply: handleApplyCoupon,
      onRemove: handleRemoveCoupon,
    },
  };

  const initNoticeTitle = needsProfile
    ? "Attendee details needed"
    : needsContactDetails
      ? "One more thing before you pay"
      : "Checkout unavailable";

  return (
    <CheckoutShell rootRef={pageRef} classesPath={classesPath} stepIndex={stepIndex}>
      {!isWide && <CheckoutSummaryStrip {...summaryProps} />}

      <div className="min-w-0 space-y-6">
        <CheckoutSection
          step={1}
          title="Your booking"
          aside={
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="pressable -my-2 -mr-2 inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              Edit basket
            </button>
          }
        >
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const schedule = scheduleLine(item);
              return (
                <li key={item.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground">{item.className}</p>
                    {item.studentName && <p className="mt-0.5 text-sm text-muted-foreground">for {item.studentName}</p>}
                    {schedule && <p className="mt-1 text-[13px] text-muted-foreground">{schedule}</p>}
                    <p className={cn("text-[13px] text-muted-foreground", schedule ? "mt-0.5" : "mt-1")}>{planLine(item)}</p>
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-foreground">
                    {formatPrice(adjusted.charges.get(item.id) ?? item.totalPrice)}
                  </p>
                </li>
              );
            })}
          </ul>
        </CheckoutSection>

        {initializing && <CheckoutFormSkeleton />}

        {initError && !initializing && (
          <div className="surface p-5 sm:p-6">
            <PaymentErrorNotice
              title={initNoticeTitle}
              body={initError}
              tone={needsContactDetails || needsProfile ? "warning" : "error"}
            >
              {needsProfile && (
                <Button onClick={() => navigate("/account")} className="h-12 w-full rounded-xl px-6 text-[15px] font-semibold sm:w-auto">
                  Add attendee details
                </Button>
              )}
              {needsContactDetails && user?.id && (
                <CustomerAddressCard
                  userId={user.id}
                  onValidChange={(valid) => {
                    // Saved and complete — build the payment form again.
                    if (!valid || contactRetries.current >= 3) return;
                    contactRetries.current += 1;
                    setRetryKey((k) => k + 1);
                  }}
                />
              )}
            </PaymentErrorNotice>
          </div>
        )}

        {clientSecret && elementsOptions && (
          <Elements stripe={getStripe()} options={elementsOptions}>
            <PaymentForm
              totalAmount={finalTotal}
              customerEmail={user?.email || profile?.email}
              clientSecret={clientSecret}
              subscriptionId={subscriptionId}
              userId={user?.id}
              onAddressValidChange={setAddressComplete}
            />
          </Elements>
        )}
      </div>

      {isWide && (
        <div className="lg:sticky lg:top-32">
          <CheckoutSummaryCard {...summaryProps} />
        </div>
      )}
    </CheckoutShell>
  );
};

export default CheckoutPage;
