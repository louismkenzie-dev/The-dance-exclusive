import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanOption<T extends string = string> {
  id: T;
  title: string;
  /** One quiet line: "Rolling monthly · billed on the 5th". */
  meta?: string;
  price: string;
  /** "/month", "/class". */
  priceSuffix?: string;
  /** "Save 10%", "Recommended". */
  badge?: string;
  disabled?: boolean;
}

interface PlanPickerProps<T extends string> {
  options: PlanOption<T>[];
  value: T | null;
  onChange: (id: T) => void;
  className?: string;
  name?: string;
}

/**
 * The plan chooser used everywhere a plan is chosen (booking sheet, basket
 * edits): radio rows with title, one line of detail, the price on the right.
 */
export function PlanPicker<T extends string>({ options, value, onChange, className, name = "plan" }: PlanPickerProps<T>) {
  return (
    <div role="radiogroup" aria-label="Choose a plan" className={cn("space-y-2", className)}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "pressable flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50",
              selected ? "border-primary bg-accent/60" : "border-border bg-card hover:border-foreground/30",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
              )}
              aria-hidden
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-foreground">{o.title}</span>
                {o.badge && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    {o.badge}
                  </span>
                )}
              </span>
              {o.meta && <span className="mt-0.5 block text-[13px] text-muted-foreground">{o.meta}</span>}
            </span>
            <span className="shrink-0 text-right">
              <span className="text-[15px] font-semibold tabular-nums text-foreground">{o.price}</span>
              {o.priceSuffix && <span className="text-xs text-muted-foreground">{o.priceSuffix}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default PlanPicker;
