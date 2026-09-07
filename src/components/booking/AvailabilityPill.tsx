import type { Availability } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

const TONE: Record<Availability["tone"], { dot: string; text: string; badge: string }> = {
  open: { dot: "bg-success", text: "text-muted-foreground", badge: "bg-success/10 text-[hsl(var(--success-strong))]" },
  low: { dot: "bg-warning", text: "text-warning", badge: "bg-warning/10 text-[hsl(var(--warning-strong))]" },
  full: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  closed: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

interface AvailabilityPillProps {
  availability: Availability;
  className?: string;
  /** "quiet" is a dot and a label; "badge" is a tinted pill for dense rows. */
  variant?: "quiet" | "badge";
}

/** A capacity indicator: "4 spaces left", "Fully booked". */
export function AvailabilityPill({ availability, className, variant = "quiet" }: AvailabilityPillProps) {
  const tone = TONE[availability.tone];
  if (variant === "badge") {
    return (
      <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold", tone.badge, className)}>
        {availability.label}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", tone.text, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      {availability.label}
    </span>
  );
}

export default AvailabilityPill;
