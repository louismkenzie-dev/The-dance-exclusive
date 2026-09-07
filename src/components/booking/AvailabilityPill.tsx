import type { Availability } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

const TONE: Record<Availability["tone"], { dot: string; text: string }> = {
  open: { dot: "bg-success", text: "text-muted-foreground" },
  low: { dot: "bg-warning", text: "text-warning" },
  full: { dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
  closed: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

/** A quiet dot-and-label capacity indicator: "4 spaces left", "Fully booked". */
export function AvailabilityPill({ availability, className }: { availability: Availability; className?: string }) {
  const tone = TONE[availability.tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", tone.text, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      {availability.label}
    </span>
  );
}

export default AvailabilityPill;
