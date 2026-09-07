import { useEffect, useRef } from "react";
import { format, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export interface DateStripDay {
  /** YYYY-MM-DD */
  date: string;
  /** Number of sessions that day; shown as a dot when > 0. */
  count?: number;
  disabled?: boolean;
}

interface DateStripProps {
  days: DateStripDay[];
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
  /** Show the month when it changes between days. */
  showMonths?: boolean;
}

/**
 * A horizontal day picker — "Mon 7 · Tue 8 · Wed 9" — the way a parent
 * thinks about the week. The selected day is ink-filled; today carries a dot.
 */
export function DateStrip({ days, value, onChange, className, showMonths = true }: DateStripProps) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the selected day in view when it changes programmatically.
  useEffect(() => {
    if (!value || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-date="${value}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);

  let lastMonth = "";
  return (
    <div
      ref={scroller}
      className={cn("no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}
      role="listbox"
      aria-label="Choose a date"
    >
      {days.map((d) => {
        const date = parseISO(d.date);
        const month = format(date, "MMM");
        const monthLabel = showMonths && month !== lastMonth ? month : null;
        lastMonth = month;
        const selected = value === d.date;
        const today = isToday(date);
        return (
          <div key={d.date} className="flex shrink-0 snap-start flex-col items-center">
            <span className={cn("mb-1 h-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", !monthLabel && "invisible")}>
              {monthLabel ?? "·"}
            </span>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              data-date={d.date}
              disabled={d.disabled}
              onClick={() => onChange(d.date)}
              className={cn(
                "pressable flex h-[68px] w-[54px] flex-col items-center justify-center rounded-2xl border text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : d.disabled
                    ? "border-border/60 bg-transparent text-muted-foreground/50"
                    : "border-border bg-card text-foreground hover:border-foreground/40",
              )}
            >
              <span className={cn("text-[11px] font-medium uppercase tracking-wide", selected ? "text-background/70" : "text-muted-foreground")}>
                {format(date, "EEE")}
              </span>
              <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{format(date, "d")}</span>
              <span
                className={cn(
                  "mt-1.5 h-1 w-1 rounded-full",
                  today ? (selected ? "bg-background" : "bg-primary") : (d.count ?? 0) > 0 ? (selected ? "bg-background/50" : "bg-muted-foreground/40") : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default DateStrip;
