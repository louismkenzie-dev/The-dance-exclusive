import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckoutSectionProps {
  /** 1, 2, 3 — the stage number shown in the small disc. */
  step: number;
  title: string;
  /** A quiet action aligned right of the heading, e.g. "Edit basket". */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes on the body, e.g. to remove the default spacing. */
  bodyClassName?: string;
}

/**
 * One staged section of the checkout: a white surface with a small numbered
 * heading, so the page reads as three calm steps rather than one long form.
 */
export function CheckoutSection({ step, title, aside, children, className, bodyClassName }: CheckoutSectionProps) {
  const headingId = `checkout-section-${step}`;
  return (
    <section aria-labelledby={headingId} className={cn("surface p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold tabular-nums text-background"
            aria-hidden
          >
            {step}
          </span>
          {title}
        </h2>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className={cn("space-y-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export default CheckoutSection;
