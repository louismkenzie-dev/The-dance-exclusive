import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Receipt,
  Sparkles,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Status = "loading" | "success" | "processing" | "error";

interface BookingDetail {
  id: string;
  status: string;
  booking_type: string;
  amount: number | null;
  created_at: string;
  notes: string | null;
  classes?: {
    name: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    venues?: { name: string; city: string | null } | null;
  } | null;
  students?: { first_name: string; last_name: string } | null;
}

const planLabel: Record<string, string> = {
  trial: "Trial",
  session: "Per Session",
  monthly: "Monthly Membership",
  term: "Full Term",
  year: "Full Year",
  yearly: "Full Year",
  pass: "Class Pass",
  camp: "Holiday Workshop",
  birthday: "Birthday Class",
};

const CheckoutReturn = () => {
  const [searchParams] = useSearchParams();
  const paymentIntentId = searchParams.get("payment_intent");
  const clientSecret = searchParams.get("payment_intent_client_secret");
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const { clearCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (!paymentIntentId && !sessionId) {
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
             classes:class_id ( name, start_time, end_time, day_of_week,
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
            { body: { paymentIntentId, environment: getStripeEnvironment() } },
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

    const checkStatus = async () => {
      try {
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
            const found = await pollForBookings(paymentIntentId);
            if (cancelled) return;
            setBookings(found);
            setStatus("success");
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
          { body: { sessionId, environment: getStripeEnvironment() } },
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
  }, [paymentIntentId, sessionId, clientSecret, clearCart, user?.id]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
          <h1 className="text-xl font-bold text-foreground">
            Confirming your payment…
          </h1>
          <p className="text-sm text-muted-foreground">
            This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
          <h1 className="text-xl font-bold text-foreground">
            Payment processing
          </h1>
          <p className="text-muted-foreground">
            Your payment is being processed. We'll email you once it's
            confirmed.
          </p>
          <Button asChild>
            <Link to="/account/bookings">View My Bookings</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We couldn't confirm your payment. Please check your bookings or try
            again.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button asChild>
              <Link to="/account/bookings">Check My Bookings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <CheckCircle2
              className="relative w-24 h-24 text-primary mx-auto"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-2">
            <Badge className="uppercase tracking-wider text-xs">
              <Sparkles className="w-3 h-3 mr-1" /> Booking Confirmed
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
              You're all booked in!
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Thank you for booking with The Dance Exclusive.
              {email && (
                <>
                  {" "}
                  A receipt has been sent to{" "}
                  <span className="text-foreground font-medium">{email}</span>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Payment summary */}
        {(amount !== null || paymentIntentId) && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Receipt className="w-5 h-5 text-primary" />
              <h2 className="font-bold uppercase tracking-wider text-sm">
                Payment Summary
              </h2>
            </div>
            <dl className="space-y-2 text-sm">
              {amount !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total paid</dt>
                  <dd className="font-bold text-lg">£{amount.toFixed(2)}</dd>
                </div>
              )}
              {email && (
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Receipt sent to
                  </dt>
                  <dd className="font-medium">{email}</dd>
                </div>
              )}
              {(paymentIntentId || sessionId) && (
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-xs">
                    {(paymentIntentId || sessionId)!.slice(-12).toUpperCase()}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {/* Booking details */}
        {bookings.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold uppercase tracking-wider text-sm text-muted-foreground">
              Your Bookings ({bookings.length})
            </h2>
            {bookings.map((b) => (
              <Card key={b.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground">
                      {b.classes?.name || "Class"}
                    </h3>
                    {b.students && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                        {b.students.first_name} {b.students.last_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {planLabel[b.booking_type] || b.booking_type}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm pt-2 border-t border-border">
                  {b.classes?.day_of_week && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="capitalize">
                        {b.classes.day_of_week}s
                      </span>
                    </div>
                  )}
                  {b.classes?.start_time && b.classes?.end_time && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>
                        {b.classes.start_time.slice(0, 5)} –{" "}
                        {b.classes.end_time.slice(0, 5)}
                      </span>
                    </div>
                  )}
                  {b.classes?.venues?.name && (
                    <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>
                        {b.classes.venues.name}
                        {b.classes.venues.city &&
                          `, ${b.classes.venues.city}`}
                      </span>
                    </div>
                  )}
                </div>

                {b.amount !== null && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Amount
                    </span>
                    <span className="font-bold">£{Number(b.amount).toFixed(2)}</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Booked on{" "}
                  {format(new Date(b.created_at), "do MMM yyyy 'at' HH:mm")}
                </div>
              </Card>
            ))}
          </div>
        )}

        {bookings.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Your booking is being created — it may take a few moments to appear
            in your account.
          </Card>
        )}

        {/* QR check-in reminder */}
        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <QrCode className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Before your first class — grab your QR code</p>
              <p className="text-muted-foreground mt-1">
                Each booking has a QR code in <Link to="/account/bookings" className="text-primary underline font-medium">My Bookings</Link>.
                Show it to a member of staff when you arrive (and when you leave) so they can scan you in and mark attendance.
                Save it to your phone or screenshot it for quick access.
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild size="lg" className="font-bold uppercase tracking-wider">
            <Link to="/account/bookings">View My Bookings</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="font-bold uppercase tracking-wider"
          >
            <Link to="/classes/children">Browse More Classes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutReturn;
