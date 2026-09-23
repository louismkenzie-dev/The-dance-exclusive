import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripe } from "@/lib/stripe";
import { buildAppearance } from "@/lib/stripeAppearance";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export interface Outstanding {
  amount: number;
  since: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the failed payment was for, when there is one. */
  outstanding: Outstanding | null;
  /** How many monthly memberships this card will be used for. */
  monthlyTotal: number;
  onDone: () => void;
}

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * The card form itself, inside <Elements> so it can see the SetupIntent.
 *
 * Saving the card and paying what's owed are deliberately two different
 * things. The card is always saved; the outstanding payment is only taken
 * when the family ticks the box that has the amount written on it.
 */
const CardForm = ({
  setupIntentId,
  outstanding,
  monthlyTotal,
  onDone,
  onClose,
}: {
  setupIntentId: string;
  outstanding: Outstanding | null;
  monthlyTotal: number;
  onDone: () => void;
  onClose: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payNow, setPayNow] = useState(true);
  const [ready, setReady] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || saving) return;
    setSaving(true);
    setError(null);

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/account/bookings` },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message || "That card couldn't be saved. Please check the details and try again.");
      setSaving(false);
      return;
    }
    if (!setupIntent || setupIntent.status !== "succeeded") {
      // Stripe is mid-redirect (3-D Secure); it will come back to the account
      // page and the card will already be saved against the customer.
      setSaving(false);
      return;
    }

    const { data, error: finishError } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      card?: { brand: string | null; last4: string | null };
      paid?: { amount: number } | null;
      payError?: string | null;
      subscriptionsUpdated?: number;
    }>("update-card", {
      body: {
        action: "finish",
        setupIntentId: setupIntent.id ?? setupIntentId,
        payOutstanding: Boolean(outstanding) && payNow,
      },
    });
    setSaving(false);

    if (finishError || !data?.success) {
      setError(data?.error || finishError?.message
        || "Your card was saved with Stripe but we couldn't put it on your membership — please contact the studio.");
      return;
    }

    const last4 = data.card?.last4 ? ` ending ${data.card.last4}` : "";
    if (data.paid) {
      toast.success(`Card${last4} saved, and ${money(data.paid.amount)} paid`, {
        description: "Your membership is back to normal.",
      });
    } else if (data.payError) {
      toast.warning(`Card${last4} saved`, { description: data.payError, duration: 10000 });
    } else {
      toast.success(`Card${last4} saved`, {
        description: monthlyTotal > 0
          ? `Your ${money(monthlyTotal)} a month will come from this card.`
          : "It will be used for your next payment.",
      });
    }
    onDone();
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!ready && <Skeleton className="h-44 w-full rounded-xl" />}
      <div className={ready ? undefined : "sr-only"}>
        <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />
      </div>

      {outstanding && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Checkbox
            checked={payNow}
            onCheckedChange={(v) => setPayNow(v === true)}
            className="mt-0.5"
            aria-label={`Also pay the ${money(outstanding.amount)} that didn't go through`}
          />
          <span className="text-sm">
            <span className="font-medium">Also pay the {money(outstanding.amount)} that didn't go through</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Taken from this card as soon as it's saved. Untick and it'll be retried automatically instead.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={!stripe || saving}>
          {saving
            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
            : outstanding && payNow
              ? <>Save card and pay {money(outstanding.amount)}</>
              : "Save card"}
        </Button>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Your card is stored by Stripe. The studio never sees the number.
      </p>
    </form>
  );
};

/**
 * Change the card a family's monthly payments come out of.
 *
 * Amie: "Jodie Cornwell has got a new card and needs to update her card
 * details for her.. How do we set her back up?" Until now there was nowhere
 * to put a new card once you were already a member — the only card form in
 * the app was inside checkout. Jodie's card failed, there was no way to
 * replace it, and eleven days later Stripe cancelled both her daughter's
 * memberships.
 */
const UpdateCardDialog = ({ open, onOpenChange, outstanding, monthlyTotal, onDone }: Props) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // The SetupIntent is created when the dialog opens, never on page load —
  // one per attempt, not one per visit to the account page.
  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      clientSecret?: string;
      setupIntentId?: string;
    }>("update-card", { body: { action: "start" } });
    setStarting(false);
    if (error || !data?.clientSecret) {
      setStartError(data?.error || error?.message || "Couldn't open the card form — please try again.");
      return;
    }
    setClientSecret(data.clientSecret);
    setSetupIntentId(data.setupIntentId ?? null);
  }, []);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setSetupIntentId(null);
      setStartError(null);
      return;
    }
    void start();
  }, [open, start]);

  const options = useMemo<StripeElementsOptions | null>(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: buildAppearance(pageRef.current),
      loader: "auto",
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" }],
    };
  }, [clientSecret]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-dialog overflow-y-auto" ref={pageRef}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {outstanding ? "Update card and settle up" : "Update your card"}
          </DialogTitle>
          <DialogDescription>
            {outstanding
              ? `We couldn't take ${money(outstanding.amount)}. Add your new card and it's sorted.`
              : monthlyTotal > 0
                ? `The card your ${money(monthlyTotal)} a month comes out of.`
                : "The card your monthly payments come out of."}
          </DialogDescription>
        </DialogHeader>

        {starting && <Skeleton className="h-44 w-full rounded-xl" />}
        {startError && (
          <div className="space-y-3">
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{startError}</p>
            <Button variant="outline" onClick={() => void start()}>Try again</Button>
          </div>
        )}
        {clientSecret && options && (
          <Elements stripe={getStripe()} options={options}>
            <CardForm
              setupIntentId={setupIntentId ?? ""}
              outstanding={outstanding}
              monthlyTotal={monthlyTotal}
              onDone={onDone}
              onClose={() => onOpenChange(false)}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCardDialog;
