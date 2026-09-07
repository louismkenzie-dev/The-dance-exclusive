import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  /** What the pill filters by when nothing is chosen: "Style". */
  label: string;
  /** The chosen value, shown in place of the label and ink-filled. */
  value?: string | null;
  onClick: () => void;
  icon?: ReactNode;
  className?: string;
}

/**
 * A filter that opens a picker rather than spilling its options across the
 * screen: "Style ▾" until something is chosen, then "Hip Hop ▾" in ink.
 */
export function FilterPill({ label, value, onClick, icon, className }: FilterPillProps) {
  const active = !!value;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={active ? `${label}: ${value}` : label}
      className={cn(
        "pressable inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border pl-4 pr-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {icon}
      <span className="max-w-[10rem] truncate">{value ?? label}</span>
      <ChevronDown className={cn("h-4 w-4 shrink-0", active ? "text-background/70" : "text-muted-foreground")} aria-hidden />
    </button>
  );
}

export default FilterPill;
