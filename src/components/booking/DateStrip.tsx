import { useEffect, useRef } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
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
  /** "Today" and "Tomorrow" in place of the weekday where they apply. */
  relativeLabels?: boolean;
  /**
   * Adds a leading "all days" tile, selected while `value` is null. The label
   * is what it says: "All days".
   */
  allDaysLabel?: string;
  onAllDays?: () => void;
}

const TILE =
  "pressable flex h-[68px] min-w-[54px] flex-col items-center justify-center rounded-2xl border px-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";
const TILE_SELECTED = "border-foreground bg-foreground text-background";
const TILE_IDLE = "border-border bg-card text-foreground hover:border-foreground/40";

/**
 * A horizontal day picker — "Today 7 · Tue 8 · Wed 9" — the way a parent
 * thinks about the week. The selected day is ink-filled; today carries a dot.
 */
export function DateStrip({ days, value, onChange, className, showMonths = true, relativeLabels = false, allDaysLabel, onAllDays }: DateStripProps) {
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
      className={cn("no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scroll-pl-4 sm:mx-0 sm:px-0 sm:scroll-pl-0", className)}
      role="listbox"
      aria-label="Choose a date"
    >
      {allDaysLabel && (
        <div className="flex shrink-0 snap-start flex-col items-center">
          <span className="invisible mb-1 h-3 text-[10px]" aria-hidden>·</span>
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={onAllDays}
            className={cn(TILE, "px-3", value === null ? TILE_SELECTED : TILE_IDLE)}
          >
            <span className={cn("text-[11px] font-medium uppercase tracking-wide", value === null ? "text-background/70" : "text-muted-foreground")}>
              {allDaysLabel}
            </span>
            <CalendarDays className="mt-1 h-5 w-5" aria-hidden />
            <span className="mt-1.5 h-1 w-1 rounded-full bg-transparent" aria-hidden />
          </button>
        </div>
      )}
      {days.map((d) => {
        const date = parseISO(d.date);
        const month = format(date, "MMM");
        const monthLabel = showMonths && month !== lastMonth ? month : null;
        lastMonth = month;
        const selected = value === d.date;
        const today = isToday(date);
        const dayLabel = relativeLabels && today ? "Today" : relativeLabels && isTomorrow(date) ? "Tomorrow" : format(date, "EEE");
        return (
          <div key={d.date} className="flex shrink-0 snap-start flex-col items-center">
            <span className={cn("mb-1 h-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", !monthLabel && "invisible")}>
              {monthLabel ?? "·"}
            </span>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={format(date, "EEEE d MMMM")}
              data-date={d.date}
              disabled={d.disabled}
              onClick={() => onChange(d.date)}
              className={cn(
                TILE,
                selected
                  ? TILE_SELECTED
                  : d.disabled
                    ? "border-border/60 bg-transparent text-muted-foreground/50"
                    : TILE_IDLE,
              )}
            >
              <span className={cn("text-[11px] font-medium uppercase tracking-wide", selected ? "text-background/70" : "text-muted-foreground")}>
                {dayLabel}
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
