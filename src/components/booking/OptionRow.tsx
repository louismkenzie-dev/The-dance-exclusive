import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionRowProps {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  /** One quiet line under the title: "Mondays · 5:00–5:45pm · Kelvedon Institute". */
  meta?: ReactNode;
  /** Right-hand slot: a price, a time. */
  trailing?: ReactNode;
  control?: "radio" | "checkbox";
  disabled?: boolean;
  /** Shown instead of the control when the row cannot be chosen ("Booked"). */
  status?: ReactNode;
  name?: string;
  className?: string;
}

/**
 * A choosable row for pickers inside sheets — a class to move to, a date to
 * take, a session to redeem. Same shape as PlanPicker's rows so every picker
 * in the journey reads alike.
 */
export function OptionRow({ selected, onSelect, title, meta, trailing, control = "radio", disabled, status, name, className }: OptionRowProps) {
  return (
    <button
      type="button"
      role={control}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      name={name}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "pressable flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        selected ? "border-primary bg-accent/60" : "border-border bg-card hover:border-foreground/30",
        disabled && "cursor-default opacity-60 hover:border-border",
        className,
      )}
    >
      {status && disabled ? null : (
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
            control === "checkbox" ? "rounded-md" : "rounded-full",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
          )}
          aria-hidden
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
        {meta && <span className="mt-0.5 block text-[13px] text-muted-foreground">{meta}</span>}
      </span>
      {status && disabled ? (
        <span className="shrink-0 text-[13px] font-medium text-success">{status}</span>
      ) : trailing ? (
        <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground">{trailing}</span>
      ) : null}
    </button>
  );
}

export default OptionRow;
