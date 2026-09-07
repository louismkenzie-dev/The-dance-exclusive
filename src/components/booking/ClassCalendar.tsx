import type { ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import type { Availability } from "@/lib/bookingFormat";
import type { ClassButtonState } from "@/lib/classPresentation";
import { cn } from "@/lib/utils";
import { AvailabilityPill } from "./AvailabilityPill";
import { DateStrip, type DateStripDay } from "./DateStrip";
import { SessionRow } from "./SessionRow";

export interface CalendarRowData {
  key: string;
  classId: string;
  startTime: string;
  endTime: string;
  title: string;
  meta: string | null;
  sub: string | null;
  availability: Availability;
  state: ClassButtonState;
  onWaitlist: boolean;
  busy?: boolean;
  highlighted?: boolean;
}

export interface CalendarGroup {
  /** YYYY-MM-DD */
  date: string;
  rows: CalendarRowData[];
}

interface ClassCalendarProps {
  days: DateStripDay[];
  /** The day on show, or null for every day in the window. */
  day: string | null;
  onChangeDay: (date: string) => void;
  onAllDays: () => void;
  /** The groups to show — one for a single day, several for all days. */
  groups: CalendarGroup[];
  /** "the next 3 weeks" — describes the window when all days are shown. */
  horizonLabel: string;
  onOpen: (classId: string) => void;
  onPrimary: (row: CalendarRowData) => void;
  /** Shown when there is nothing in the window. */
  empty?: ReactNode;
  className?: string;
}

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const tomorrowStr = () => format(addDays(new Date(), 1), "yyyy-MM-dd");

/** "Today", "Tomorrow", otherwise "Monday 14 September". */
export const calendarDayLabel = (date: string): string =>
  date === todayStr() ? "Today" : date === tomorrowStr() ? "Tomorrow" : format(parseISO(date), "EEEE d MMMM");

const ctaFor = (row: CalendarRowData): { label: string; disabled: boolean; quiet: boolean } => {
  if (row.state === "full") return { label: row.onWaitlist ? "On waitlist" : "Join waitlist", disabled: !!row.busy, quiet: false };
  if (row.state === "invite") return { label: "Invite only", disabled: true, quiet: true };
  if (row.state === "soon") return { label: "Coming soon", disabled: true, quiet: true };
  return { label: "Book", disabled: !!row.busy, quiet: false };
};

/**
 * Classes by day: a strip of days across the top, then each session that day
 * as a row — time, class, where, whether there's room, one button. The way a
 * parent plans a week.
 */
export function ClassCalendar({ days, day, onChangeDay, onAllDays, groups, horizonLabel, onOpen, onPrimary, empty, className }: ClassCalendarProps) {
  const renderRow = (row: CalendarRowData) => {
    const cta = ctaFor(row);
    const badge =
      row.state === "bookable" || row.state === "full" ? (
        <AvailabilityPill availability={row.availability} variant="badge" />
      ) : null;
    const action = cta.quiet ? (
      <span className="text-[13px] font-medium text-muted-foreground">{cta.label}</span>
    ) : (
      <button
        type="button"
        onClick={() => onPrimary(row)}
        disabled={cta.disabled}
        className={cn(
          "pressable inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card disabled:opacity-60",
          row.state === "full"
            ? "border border-border bg-card text-foreground hover:border-foreground/40"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {cta.label}
      </button>
    );
    return (
      <SessionRow
        key={row.key}
        id={`session-${row.key}`}
        startTime={row.startTime}
        endTime={row.endTime}
        title={row.title}
        meta={row.meta}
        sub={row.sub}
        badge={badge}
        action={action}
        highlighted={row.highlighted}
        onOpen={() => onOpen(row.classId)}
      />
    );
  };

  return (
    <div className={className}>
      {days.length > 0 && (
        <DateStrip
          days={days}
          value={day}
          onChange={onChangeDay}
          relativeLabels
          allDaysLabel="All days"
          onAllDays={onAllDays}
        />
      )}

      <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {day ? calendarDayLabel(day) : "All days"}
        <span className="ml-2 text-[13px] font-normal text-muted-foreground">
          {day ? format(parseISO(day), "d MMM yyyy") : horizonLabel}
        </span>
      </h2>

      {groups.length === 0 ? (
        <div className="mt-4">{empty}</div>
      ) : day ? (
        <div className="surface mt-4 divide-y divide-border/70 overflow-hidden">{groups[0]?.rows.map(renderRow)}</div>
      ) : (
        groups.map((g) => (
          <section key={g.date} className="mt-6" aria-label={calendarDayLabel(g.date)}>
            {/* Sticks just below the portal header while its day scrolls */}
            <h3 className="sticky top-16 z-10 -mx-2 bg-background/95 px-2 py-2 text-[15px] font-semibold text-foreground backdrop-blur-sm md:top-28">
              {calendarDayLabel(g.date)}
              <span className="ml-2 text-[13px] font-normal text-muted-foreground">{format(parseISO(g.date), "d MMM yyyy")}</span>
            </h3>
            <div className="surface mt-1 divide-y divide-border/70 overflow-hidden">{g.rows.map(renderRow)}</div>
          </section>
        ))
      )}
    </div>
  );
}

export default ClassCalendar;
