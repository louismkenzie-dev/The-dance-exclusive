import { useEffect, useState } from "react";
import { getPaymentsEnvironment } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  const [testMode, setTestMode] = useState(false);

  // The banner follows the server-side payments mode (same switch the payment
  // functions use), so it disappears the moment payments go live.
  useEffect(() => {
    let cancelled = false;
    getPaymentsEnvironment()
      .then((env) => {
        if (!cancelled) setTestMode(env === "sandbox");
      })
      .catch(() => {
        if (!cancelled) setTestMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!testMode) return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      All payments made in the preview are in test mode.{" "}
      <a
        href="https://stripe.com/docs/testing"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Read more about test mode
      </a>
    </div>
  );
}
