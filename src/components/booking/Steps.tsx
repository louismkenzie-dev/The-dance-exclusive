import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepsProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

/**
 * Where the parent is in the flow. On a phone it collapses to "Step 2 of 4 ·
 * Who's attending"; wider screens show the whole path.
 */
export function Steps({ steps, current, className }: StepsProps) {
  return (
    <nav aria-label="Progress" className={cn("text-sm", className)}>
      <p className="text-muted-foreground sm:hidden">
        <span className="font-medium text-foreground">Step {current + 1} of {steps.length}</span>
        {" · "}
        {steps[current]}
      </p>
      <ol className="hidden items-center gap-3 sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    done && "bg-foreground text-background",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "border border-border text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground")} aria-current={active ? "step" : undefined}>
                  {label}
                </span>
              </span>
              {i < steps.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Steps;
