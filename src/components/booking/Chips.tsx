import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Small count or hint rendered after the label. */
  trailing?: ReactNode;
}

/** A filter chip: rounded, comfortable to tap, ink-filled when selected. */
export function Chip({ selected = false, onClick, children, className, disabled, trailing }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "pressable inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {children}
      {/* A count of 0 is still worth showing — only nothing at all is skipped. */}
      {trailing != null && trailing !== false && trailing !== "" && (
        <span className={cn("text-xs", selected ? "text-background/70" : "text-muted-foreground")}>{trailing}</span>
      )}
    </button>
  );
}

/**
 * A horizontally scrolling row of chips that bleeds to the screen edge on a
 * phone and wraps naturally on wider screens.
 */
export function ChipRow({ children, className, wrap = false }: { children: ReactNode; className?: string; wrap?: boolean }) {
  return (
    <div
      className={cn(
        "no-scrollbar flex gap-2",
        wrap ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        className,
      )}
      role="group"
    >
      {children}
    </div>
  );
}

export default Chip;
