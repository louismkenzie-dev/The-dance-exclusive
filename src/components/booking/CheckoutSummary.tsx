import { useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { CartItem } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/bookingFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CHECKOUT_PLAN_LABEL } from "./checkoutItemText";

export interface SummaryNote {
  key: string;
  text: string;
  /** Brand-coloured for the "nothing to pay today" and cap lines. */
  emphasis?: boolean;
}

export interface CheckoutSummaryTotals {
  /** The raw basket sum. */
  subtotal: number;
  /** Shown when > 0.005. */
  multiClassDiscount: number;
  /** Shown when > 0. */
  siblingDiscount: number;
  coupon: { code: string; discountAmount: number } | null;
  /** The figure the parent will actually be charged (server's when known). */
  total: number;
}

export interface CheckoutSummaryCouponState {
  applied: { code: string; discountAmount: number } | null;
  input: string;
  onInputChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onApply: () => void;
  onRemove: () => void;
}

export interface CheckoutSummaryProps {
  items: CartItem[];
  /** Adjusted per-item charges; falls back to the item's own price. */
  charges: Map<string, number>;
  totals: CheckoutSummaryTotals;
  notes?: SummaryNote[];
  coupon: CheckoutSummaryCouponState;
  className?: string;
}

const Row = ({ label, value, tone = "muted", strong }: { label: ReactNode; value: string; tone?: "muted" | "saving" | "total"; strong?: boolean }) => (
  <div className={cn("flex items-baseline justify-between gap-4", tone === "total" ? "pt-3" : "text-sm")}>
    <dt
      className={cn(
        tone === "muted" && "text-muted-foreground",
        tone === "saving" && "text-success",
        tone === "total" && "text-[15px] font-semibold text-foreground",
      )}
    >
      {label}
    </dt>
    <dd
      className={cn(
        "tabular-nums",
        tone === "muted" && "text-foreground",
        tone === "saving" && "text-success",
        tone === "total" && "text-2xl font-semibold tracking-tight text-foreground",
        strong && "font-medium",
      )}
    >
      {value}
    </dd>
  </div>
);

/** Item rows, the totals block, the notes and the code disclosure. */
export function CheckoutSummary({ items, charges, totals, notes = [], coupon, className }: CheckoutSummaryProps) {
  const [codeOpen, setCodeOpen] = useState(false);
  const showCodeField = codeOpen || !!coupon.input || !!coupon.error;

  return (
    <div className={className}>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const meta = [item.studentName ? `for ${item.studentName}` : null, CHECKOUT_PLAN_LABEL[item.pricingPlan]]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.className}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{meta}</p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatPrice(charges.get(item.id) ?? item.totalPrice)}
              </p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-1 space-y-2 border-t border-border pt-4">
        <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
        {totals.multiClassDiscount > 0.005 && (
          <Row label="Additional-class rate" value={`−${formatPrice(totals.multiClassDiscount)}`} tone="saving" />
        )}
        {totals.siblingDiscount > 0 && (
          <Row label="Sibling discount (10%)" value={`−${formatPrice(totals.siblingDiscount)}`} tone="saving" />
        )}
        {totals.coupon && (
          <Row label={`Discount (${totals.coupon.code})`} value={`−${formatPrice(totals.coupon.discountAmount)}`} tone="saving" />
        )}
        <Row label="Total" value={formatPrice(totals.total)} tone="total" />
      </dl>

      {notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {notes.map((n) => (
            <p
              key={n.key}
              className={cn("text-[13px] leading-relaxed", n.emphasis ? "font-medium text-primary" : "text-muted-foreground")}
            >
              {n.text}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {coupon.applied ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3.5 py-2.5">
            <p className="min-w-0 truncate text-[13px] text-foreground">
              <span className="font-semibold tracking-wide">{coupon.applied.code}</span>
              <span className="text-muted-foreground"> · Saving {formatPrice(coupon.applied.discountAmount)}</span>
            </p>
            <button
              type="button"
              onClick={coupon.onRemove}
              className="pressable shrink-0 rounded-md px-1 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              aria-expanded={showCodeField}
              onClick={() => setCodeOpen((o) => !o)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md text-left text-sm font-medium text-foreground/80 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              Have a code or studio credit?
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showCodeField && "rotate-180")} />
            </button>
            {showCodeField && (
              <div className="mt-2">
                <div className="flex gap-2">
                  <Input
                    aria-label="Discount code"
                    value={coupon.input}
                    onChange={(e) => coupon.onInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        coupon.onApply();
                      }
                    }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-12 rounded-xl text-base uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal"
                    disabled={coupon.submitting}
                  />
                  <Button
                    type="button"
                    variant="soft"
                    onClick={coupon.onApply}
                    disabled={coupon.submitting || !coupon.input.trim()}
                    className="h-12 shrink-0 rounded-xl px-5 text-[15px] font-semibold"
                  >
                    {coupon.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {coupon.error && <p className="mt-2 text-[13px] text-destructive">{coupon.error}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The desktop right-hand column. */
export function CheckoutSummaryCard(props: CheckoutSummaryProps) {
  return (
    <aside aria-labelledby="checkout-summary-heading" className={cn("surface p-5 sm:p-6", props.className)}>
      <h2 id="checkout-summary-heading" className="mb-4 text-base font-semibold text-foreground">
        Your booking
      </h2>
      <CheckoutSummary {...props} className={undefined} />
    </aside>
  );
}

/** The phone strip: one line with the total, opening to the full summary. */
export function CheckoutSummaryStrip(props: CheckoutSummaryProps) {
  const count = props.items.length;
  return (
    <Collapsible defaultOpen={false} className={cn("surface overflow-hidden", props.className)}>
      <CollapsibleTrigger className="group flex min-h-[56px] w-full items-center justify-between gap-3 px-5 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold text-foreground">Your booking</span>
          <span className="text-muted-foreground">
            {" · "}
            {count} item{count === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-foreground">{formatPrice(props.totals.total)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="border-t border-border px-5 pb-5 pt-4">
          <CheckoutSummary {...props} className={undefined} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CheckoutSummary;
