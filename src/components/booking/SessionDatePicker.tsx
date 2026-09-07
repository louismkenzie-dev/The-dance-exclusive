import { useEffect, useRef } from "react";
import { format, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { allSelected, summariseSelection, type SummarisableSession } from "./sessionDateSummary";

export interface SessionDatePickerSession extends SummarisableSession {
  startTime?: string | null;
  endTime?: string | null;
  /**
   * Already in the basket for the chosen attendee(s). A hint only — the
   * date stays selectable, exactly as the old list did; the basket dedupes
   * when the booking is added.
   */
  inBasket?: boolean;
}

interface SessionDatePickerProps {
  sessions: SessionDatePickerSession[];
  /** Selected session ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Pick several (pay as you go, camp days) or exactly one (trial). */
  multiple?: boolean;
  /** Show the "Select all / Clear" text action. Defaults to `multiple`. */
  selectAll?: boolean;
  /** Display only — every tile shows as chosen, nothing responds. */
  readOnly?: boolean;
  /** "date" | "day" — the word used in the summary line. */
  noun?: string;
  /** Summary shown when nothing is chosen. */
  emptySummary?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * The date control for the booking sheets: a horizontally scrolling row of
 * day tiles, the same shape as DateStrip, that a parent taps to pick the
 * classes they want. Chosen tiles are ink-filled; dates already in the basket
 * carry a small dot; the month is marked where it changes.
 */
export function SessionDatePicker({
  sessions,
  value,
  onChange,
  multiple = true,
  selectAll,
  readOnly = false,
  noun = "date",
  emptySummary,
  className,
  ariaLabel = "Choose dates",
}: SessionDatePickerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const showSelectAll = (selectAll ?? multiple) && !readOnly;
  const everySelected = allSelected(sessions, value);
  const anyInBasket = sessions.some((s) => s.inBasket);

  // Bring the first chosen tile into view when a selection arrives from
  // outside (an edit dialog opening on an existing booking).
  useEffect(() => {
    if (!scroller.current || value.length === 0) return;
    const first = sessions.find((s) => value.includes(s.id));
    if (!first) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-session="${first.id}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    // Only when the list itself changes; tapping tiles must not scroll the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length]);

  const toggle = (id: string) => {
    if (readOnly) return;
    // Single choice behaves like a radio: tapping the chosen date keeps it.
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  let lastMonth = "";
  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={scroller}
        role="group"
        aria-label={ariaLabel}
        // scroll-padding matches the inline padding so the first tile's snap
        // point does not swallow the sheet's gutter.
        className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 scroll-pl-5 sm:-mx-6 sm:px-6 sm:scroll-pl-6"
      >
        {sessions.map((s) => {
          const date = parseISO(s.date);
          const month = format(date, "MMM");
          const monthLabel = month !== lastMonth ? month : null;
          lastMonth = month;
          const selected = readOnly || value.includes(s.id);
          const today = isToday(date);
          const label = `${format(date, "EEEE d MMMM")}${s.inBasket ? " (already in your basket)" : ""}`;
          return (
            <div key={s.id} className="flex shrink-0 snap-start flex-col items-center">
              <span
                className={cn("mb-1 h-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", !monthLabel && "invisible")}
                aria-hidden
              >
                {monthLabel ?? "·"}
              </span>
              <button
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={selected}
                aria-label={label}
                data-session={s.id}
                disabled={readOnly}
                onClick={() => toggle(s.id)}
                className={cn(
                  "pressable flex h-[68px] w-[54px] flex-col items-center justify-center rounded-2xl border text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : s.inBasket
                      ? "border-border bg-muted/40 text-muted-foreground hover:border-foreground/40"
                      : "border-border bg-card text-foreground hover:border-foreground/40",
                  readOnly && "cursor-default opacity-100",
                )}
              >
                <span className={cn("text-[11px] font-medium uppercase tracking-wide", selected ? "text-background/70" : "text-muted-foreground")}>
                  {format(date, "EEE")}
                </span>
                <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{format(date, "d")}</span>
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 rounded-full",
                    s.inBasket
                      ? selected ? "bg-background/70" : "bg-primary"
                      : today
                        ? selected ? "bg-background" : "bg-primary"
                        : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-[20px] items-center justify-between gap-3 text-[13px]">
        <p className="min-w-0 truncate text-muted-foreground" aria-live="polite">
          {readOnly
            ? `${sessions.length} ${noun}${sessions.length === 1 ? "" : "s"}`
            : summariseSelection(sessions, value, { noun, empty: emptySummary })}
          {anyInBasket && !readOnly && (
            <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              in basket
            </span>
          )}
        </p>
        {showSelectAll && sessions.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(everySelected ? [] : sessions.map((s) => s.id))}
            className="shrink-0 rounded-md font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
          >
            {everySelected ? "Clear" : "Select all"}
          </button>
        )}
      </div>
    </div>
  );
}

export default SessionDatePicker;
