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
    <div
      role="status"
      className="w-full border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-[13px] font-medium text-warning"
    >
      All payments made in the preview are in test mode.{" "}
      <a
        href="https://stripe.com/docs/testing"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 hover:no-underline"
      >
        Read more about test mode
      </a>
    </div>
  );
}
