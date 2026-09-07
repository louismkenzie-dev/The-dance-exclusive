import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BookingSheetFooterProps {
  /** The headline figure: "£27.20". Omit to show `hint` instead. */
  amount?: string | null;
  /** "/month", "/term". */
  amountSuffix?: string;
  /** Second, muted line: "£9.00 × 2 sessions · 2 children". */
  note?: string;
  /** Shown in place of a price when there is nothing to total yet. */
  hint?: string;
  /** The one primary action (and, in edit dialogs, its Cancel). */
  action: ReactNode;
  className?: string;
}

/**
 * Sticky footer of a booking sheet: price summary on the left, action on the
 * right. Carries its own bottom padding on phones, where the sheet's
 * safe-area padding is zero on devices without a home indicator.
 */
export function BookingSheetFooter({ amount, amountSuffix, note, hint, action, className }: BookingSheetFooterProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 pb-2 md:pb-0", className)}>
      <div className="min-w-0 flex-1">
        {amount ? (
          <>
            <p className="text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
              {amount}
              {amountSuffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{amountSuffix}</span>}
            </p>
            {note && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{note}</p>}
          </>
        ) : (
          hint && <p className="text-[13px] text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{action}</div>
    </div>
  );
}

export default BookingSheetFooter;
