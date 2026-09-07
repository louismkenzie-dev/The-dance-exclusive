import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStripe } from "@/lib/stripe";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Bone, EmptyState, SuccessCheck } from "@/components/booking";
import { ConfirmationBookingCard } from "@/components/booking/ConfirmationBookingCard";
import type { ConfirmationBooking } from "@/components/booking/confirmationBooking";
import { formatPrice } from "@/lib/bookingFormat";

type Status = "loading" | "success" | "processing" | "error";

/** The booking row as selected below; `classes.term_end` feeds the calendar link's weekly repeat. */
type BookingDetail = ConfirmationBooking;

/** "5 October" in the studio's zone, or the standing fallback when the server has not said. */
const formatFirstPayment = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/London",
      })
    : "the 5th of next month";

const CheckoutReturn = () => {
  const [searchParams] = useSearchParams();
  const paymentIntentId = searchParams.get("payment_intent");
  const clientSecret = searchParams.get("payment_intent_client_secret");
  const sessionId = searchParams.get("session_id");
  // August £0-today membership signups arrive with SetupIntent params
  // (appended by Stripe on redirect, or by Checkout's inline hand-off) plus
  // our own ?subscription= from the return_url.
  const setupIntentId = searchParams.get("setup_intent");
  const setupClientSecret = searchParams.get("setup_intent_client_secret");
  const subscriptionId = searchParams.get("subscription");
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  // Setup (£0-today) success variant: no payment summary, first-charge date.
  const [isSetup, setIsSetup] = useState(false);
  const [firstPaymentDate, setFirstPaymentDate] = useState<string | null>(null);
  const { clearCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (!paymentIntentId && !sessionId && !setupClientSecret && !subscriptionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;

    const pollForBookings = async (note: string) => {
      // Webhooks can take a few seconds — poll up to ~20s.
      for (let i = 0; i < 10; i++) {
        if (cancelled) return [];
        const { data } = await supabase
          .from("bookings")
          .select(
            `id, status, booking_type, amount, created_at, notes,
             classes:class_id ( name, start_time, end_time, day_of_week, term_end,
                               venues:venue_id ( name, city ) ),
             camps:camp_id ( name, start_date, end_date,
                             venues:venue_id ( name, city ) ),
             students:student_id ( first_name, last_name )`,
          )
          .ilike("notes", `%${note}%`)
          .order("created_at", { ascending: true });
        if (data && data.length > 0) return data as BookingDetail[];
        await new Promise((r) => setTimeout(r, 2000));
      }
      return [];
    };

    // The edge function both reports status AND acts as the webhook fallback
    // that guarantees bookings + the confirmation email. Retry it a few times
    // but never let a transient failure decide the outcome on its own.
    const fetchServerStatus = async (): Promise<{ status: string; amount?: number; receiptEmail?: string | null } | null> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return null;
        try {
          const { data, error } = await supabase.functions.invoke(
            "get-payment-intent-status",
            { body: { paymentIntentId } },
          );
          if (!error && data?.status) return data;
        } catch {
          // fall through to retry
        }
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
      return null;
    };

    // Client-side source of truth: Stripe itself. Works even when the edge
    // function is briefly unreachable, for both the inline hand-off and
    // Stripe's own redirect return (same URL params).
    const fetchStripeStatus = async (): Promise<string | null> => {
      if (!clientSecret) return null;
      try {
        const stripe = await getStripe();
        if (!stripe) return null;
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        return paymentIntent?.status ?? null;
      } catch {
        return null;
      }
    };

    // £0-today membership setup: verify the SetupIntent with Stripe, then ask
    // the server to finalize (attach the payment method + activate bookings —
    // idempotent, also retried by the daily maintenance job).
    const checkSetupStatus = async () => {
      try {
        let setupStatus: string | null = null;
        if (setupClientSecret) {
          try {
            const stripe = await getStripe();
            if (stripe) {
              const { setupIntent } = await stripe.retrieveSetupIntent(setupClientSecret);
              setupStatus = setupIntent?.status ?? null;
            }
          } catch {
            // fall back to the redirect status below
          }
        }
        if (cancelled) return;
        // Stripe unreachable (or link revisited without the secret) — trust
        // the redirect_status Stripe/Checkout stamped on the URL.
        const succeeded =
          setupStatus === "succeeded" ||
          (setupStatus == null && searchParams.get("redirect_status") === "succeeded");

        if (!succeeded) {
          setStatus(
            setupStatus === "processing" || setupStatus === "requires_action"
              ? "processing"
              : "error",
          );
          return;
        }

        setIsSetup(true);
        clearCart();
        if (subscriptionId) {
          try {
            const { data } = await supabase.functions.invoke(
              "finalize-membership-setup",
              { body: { subscriptionId } },
            );
            if (!cancelled && data?.firstPaymentDate) {
              setFirstPaymentDate(data.firstPaymentDate);
            }
          } catch {
            // maintenance job completes the activation — don't fail the UI
          }
        }
        if (cancelled) return;
        setStatus("success");
        if (subscriptionId) {
          // Setup-mode bookings reference the subscription id in their notes.
          void pollForBookings(subscriptionId).then((found) => {
            if (!cancelled) setBookings(found);
          });
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    const checkStatus = async () => {
      try {
        if (!paymentIntentId && !sessionId && (setupClientSecret || setupIntentId || subscriptionId)) {
          await checkSetupStatus();
          return;
        }

        if (paymentIntentId) {
          const [server, stripeStatus] = await Promise.all([
            fetchServerStatus(),
            fetchStripeStatus(),
          ]);
          if (cancelled) return;

          const effective = server?.status ?? stripeStatus;
          if (effective === "succeeded") {
            setEmail(server?.receiptEmail ?? null);
            setAmount(server?.amount ? server.amount / 100 : null);
            clearCart();
            // Show success immediately — payment is confirmed. Booking details
            // load in the background (and a pass-only purchase has no booking
            // rows at all, so we must never block the success screen on them).
            setStatus("success");
            void pollForBookings(paymentIntentId).then((found) => {
              if (!cancelled) setBookings(found);
            });
          } else if (
            effective === "processing" ||
            effective === "requires_action" ||
            // Both lookups failed but Stripe told us at redirect time that the
            // payment succeeded — never show a scary error for a paid booking.
            (effective == null && searchParams.get("redirect_status") === "succeeded")
          ) {
            if (searchParams.get("redirect_status") === "succeeded") clearCart();
            setStatus("processing");
          } else {
            setStatus("error");
          }
          return;
        }

        // Legacy Embedded Checkout flow
        const { data, error } = await supabase.functions.invoke(
          "get-session-status",
          { body: { sessionId } },
        );
        if (cancelled) return;
        if (error || !data) return setStatus("error");

        if (data.paymentStatus === "paid" || data.status === "complete") {
          setEmail(data.customerEmail);
          setAmount(data.amountTotal ? data.amountTotal / 100 : null);
          clearCart();
          const found = await pollForBookings(sessionId!);
          if (cancelled) return;
          setBookings(found);
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentIntentId, sessionId, clientSecret, setupIntentId, setupClientSecret, subscriptionId, clearCart, user?.id]);

  if (status === "loading") {
    return (
      <div className="container max-w-2xl py-10 pb-16 sm:py-16" aria-busy="true">
        <div className="flex flex-col items-center">
          <Bone className="h-[88px] w-[88px] rounded-full" />
          <Bone className="mt-6 h-8 w-44 rounded-lg" />
          <Bone className="mt-3 h-4 w-64" />
        </div>
        <div className="surface mt-10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2.5">
              <Bone className="h-5 w-2/5" />
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-1/4" />
            </div>
            <Bone className="h-5 w-14" />
          </div>
          <div className="mt-5 space-y-2.5">
            <Bone className="h-4 w-3/5" />
            <Bone className="h-4 w-1/2" />
          </div>
        </div>
        <p role="status" className="mt-8 text-center text-sm text-muted-foreground">
          Confirming your payment…
        </p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="container max-w-lg py-12 pb-16 sm:py-20">
        <EmptyState
          title="Payment processing"
          body="Your payment is being processed. We'll email you once it's confirmed."
          action={
            <Button asChild variant="soft" size="xl" className="pressable w-full rounded-full sm:w-auto sm:px-10">
              <Link to="/account/bookings">View my bookings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container max-w-lg py-12 pb-16 sm:py-20">
        <EmptyState
          tone="error"
          title="We couldn't confirm your payment"
          body="If money has left your account, your booking will appear in My Bookings within a few minutes and you'll get an email. Otherwise nothing has been taken."
          action={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="xl" className="pressable rounded-full sm:px-8">
                <Link to="/account/bookings">Check my bookings</Link>
              </Button>
              <Button asChild variant="soft" size="xl" className="pressable rounded-full sm:px-8">
                <Link to="/classes/children">Back to classes</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // SUCCESS
  const reference = (paymentIntentId || sessionId)?.slice(-12).toUpperCase();

  return (
    <div className="container max-w-2xl py-10 pb-16 sm:py-16">
      {/* Hero */}
      <header className="animate-rise-in text-center">
        <SuccessCheck />
        <h1 className="mt-6 text-[28px] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl">
          {isSetup ? "Membership set up" : "You're booked"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-[15px] leading-relaxed text-muted-foreground">
          {isSetup ? (
            <>
              Nothing to pay today — your first payment is on{" "}
              <span className="font-medium text-foreground">{formatFirstPayment(firstPaymentDate)}</span>.
            </>
          ) : (
            <>
              Thanks for booking with The Dance Exclusive.
              {email && (
                <>
                  {" "}
                  A receipt has been sent to <span className="font-medium text-foreground">{email}</span>.
                </>
              )}
            </>
          )}
        </p>
      </header>

      {/* Bookings — success never waits for these; pass-only purchases have none. */}
      <section className="mt-10 space-y-3" aria-label="Your bookings">
        {bookings.map((b, i) => (
          <ConfirmationBookingCard key={b.id} booking={b} index={i} />
        ))}
        {bookings.length === 0 && (
          <div
            className="surface animate-rise-in text-balance px-5 py-6 text-center text-sm leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
            role="status"
          >
            Your booking is being created… it will appear in My Bookings in a few moments.
          </div>
        )}
      </section>

      {/* Payment details */}
      {(amount !== null || paymentIntentId) && (
        <dl className="mt-8 divide-y divide-border/70 rounded-2xl bg-muted/50 px-5 text-sm">
          {amount !== null && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Total paid</dt>
              <dd className="font-semibold tabular-nums text-foreground">{formatPrice(amount)}</dd>
            </div>
          )}
          {email && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="shrink-0 text-muted-foreground">Receipt sent to</dt>
              <dd className="min-w-0 break-words text-right text-foreground">{email}</dd>
            </div>
          )}
          {reference && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-mono text-[13px] text-foreground">{reference}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Next step */}
      <p className="mx-auto mt-8 max-w-md text-balance text-center text-sm leading-relaxed text-muted-foreground">
        Show the QR code in{" "}
        <Link
          to="/account/bookings"
          className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
        >
          My Bookings
        </Link>{" "}
        when you arrive and leave.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-center">
        <Button asChild size="xl" className="pressable w-full rounded-full sm:w-auto sm:min-w-[220px]">
          <Link to="/account/bookings">View my bookings</Link>
        </Button>
        <Button asChild variant="soft" size="xl" className="pressable w-full rounded-full sm:w-auto sm:min-w-[220px]">
          <Link to="/classes/children">Back to classes</Link>
        </Button>
      </div>
    </div>
  );
};

export default CheckoutReturn;
