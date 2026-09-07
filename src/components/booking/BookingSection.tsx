import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BookingSectionProps {
  /** "Plan", "Who's attending", "Dates". */
  label: ReactNode;
  /** Quiet action on the right of the label ("Add a child"). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** One labelled block of a booking sheet: small muted label, then the control. */
export function BookingSection({ label, aside, children, className }: BookingSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-medium text-muted-foreground">{label}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default BookingSection;
