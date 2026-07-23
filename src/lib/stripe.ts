import { loadStripe, Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

export type PaymentsEnvironment = "sandbox" | "live";

export interface PaymentsConfig {
  environment: PaymentsEnvironment;
  publishableKey: string;
  /** Stripe Connect: The Dance Exclusive's connected account. Stripe.js must
   *  be initialised with it so the Payment Element can confirm PaymentIntents
   *  created as direct charges on that account. */
  connectedAccount?: string;
}

// ---------------------------------------------------------------------------
// Which environment to use is decided SERVER-SIDE (app_settings.payments_mode,
// read below) — the same switch the payment edge functions use, so client and
// server can never disagree. The values here are key PAIRS for each mode.
// Publishable keys and account ids are public by design: they ship in every
// browser bundle.
// ---------------------------------------------------------------------------

// Live pair — filled at go-live. The publishable key comes from the Nullshift
// platform Stripe dashboard (Developers → API keys).
const LIVE_PUBLISHABLE_KEY = "";
const LIVE_CONNECTED_ACCOUNT = "acct_1TqvwgCcuURED2Xm";

// Sandbox pair — prefer the build-time env (Vercel/.env); fall back to the
// known platform test key so local dev works without configuration.
const envToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const envAccount = import.meta.env.VITE_STRIPE_CONNECTED_ACCOUNT as string | undefined;
const SANDBOX_FALLBACK_KEY =
  "pk_test_51TgWSaE0aLvInrlqDFLIKrIu5yfVvKINObl3FYzft8FrIWuotaDqMe05whnwLBt33krOYin0PlcK230U0vuhDbqa00gd2rgcIs";
const SANDBOX_FALLBACK_ACCOUNT = "acct_1TnJ2NE0aLUyRazc";

/** Exported for tests. Picks the key pair for a mode, keeping key and account
 *  together so a half-updated build env can never mix environments. */
export function resolvePaymentsConfig(mode: PaymentsEnvironment): PaymentsConfig {
  if (mode === "live") {
    if (LIVE_PUBLISHABLE_KEY.startsWith("pk_live_")) {
      return { environment: "live", publishableKey: LIVE_PUBLISHABLE_KEY, connectedAccount: LIVE_CONNECTED_ACCOUNT };
    }
    if (envToken?.startsWith("pk_live_")) {
      return {
        environment: "live",
        publishableKey: envToken,
        connectedAccount: envAccount?.startsWith("acct_") ? envAccount : undefined,
      };
    }
    // Fail closed: a build without live keys must never fall back to sandbox
    // while the server is creating live PaymentIntents.
    throw new Error("Live payments are not configured in this build — please refresh the page or try again shortly.");
  }
  if (envToken?.startsWith("pk_test_")) {
    return {
      environment: "sandbox",
      publishableKey: envToken,
      connectedAccount: envAccount?.startsWith("acct_") ? envAccount : undefined,
    };
  }
  return { environment: "sandbox", publishableKey: SANDBOX_FALLBACK_KEY, connectedAccount: SANDBOX_FALLBACK_ACCOUNT };
}

let configPromise: Promise<PaymentsConfig> | null = null;

/** The active payments configuration, resolved once per page load from the
 *  server-side switch. Falls back to the build-time key's mode if the lookup
 *  fails (e.g. offline dev). */
export function getPaymentsConfig(): Promise<PaymentsConfig> {
  if (!configPromise) {
    configPromise = (async () => {
      let mode: PaymentsEnvironment =
        envToken && !envToken.startsWith("pk_test_") ? "live" : "sandbox";
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "payments_mode")
          .maybeSingle();
        if (!error && (data?.value === "live" || data?.value === "sandbox")) {
          mode = data.value;
        }
      } catch {
        // keep the build-time fallback mode
      }
      return resolvePaymentsConfig(mode);
    })().catch((e) => {
      configPromise = null; // don't cache failures — allow retry
      throw e;
    });
  }
  return configPromise;
}

export async function getPaymentsEnvironment(): Promise<PaymentsEnvironment> {
  return (await getPaymentsConfig()).environment;
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = getPaymentsConfig()
      .then((cfg) =>
        loadStripe(
          cfg.publishableKey,
          cfg.connectedAccount ? { stripeAccount: cfg.connectedAccount } : undefined,
        ),
      )
      .catch((e) => {
        stripePromise = null; // don't cache failures — allow retry
        throw e;
      });
  }
  return stripePromise;
}
