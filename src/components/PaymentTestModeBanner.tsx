const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-warning/10 border-b border-warning/20 px-4 py-2 text-center text-sm text-warning">
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
