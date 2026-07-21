import { loadStripe, Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
// Stripe Connect: when charges are created directly on The Dance Exclusive's
// connected account (via the Nullshift platform key), Stripe.js must be
// initialised with that connected account so the Payment Element can confirm
// PaymentIntents that live on it. Unset = pre-Connect behaviour.
const connectedAccount = import.meta.env.VITE_STRIPE_CONNECTED_ACCOUNT as string | undefined;
const environment = clientToken?.startsWith("pk_test_") ? "sandbox" : "live";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    }
    stripePromise = loadStripe(
      clientToken,
      connectedAccount?.startsWith("acct_") ? { stripeAccount: connectedAccount } : undefined,
    );
  }
  return stripePromise;
}

export function getStripeEnvironment(): string {
  return environment;
}
