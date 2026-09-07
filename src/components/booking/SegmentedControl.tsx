import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Segment<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Two or three ways of looking at the same thing — "List · Calendar". */
export function SegmentedControl<T extends string>({ segments, value, onChange, ariaLabel, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex h-12 shrink-0 items-center rounded-full bg-muted p-1", className)}>
      {segments.map((s) => {
        const selected = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(s.id)}
            className={cn(
              "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.icon}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
