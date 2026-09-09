import type { ReactNode } from "react";
import { durationLabel, formatTime } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";

interface SessionRowProps {
  id?: string;
  startTime: string;
  endTime: string;
  title: ReactNode;
  /** One quiet line: "Street · Kelvedon Institute · with Amie". */
  meta?: ReactNode;
  /** A second quiet line: "Ages 3–7 · £27.20/month". */
  sub?: ReactNode;
  /** Top-right: the availability badge. */
  badge?: ReactNode;
  /** Bottom-right: the one action. */
  action?: ReactNode;
  /** Tap on the time or the title. */
  onOpen?: () => void;
  highlighted?: boolean;
  className?: string;
}

/**
 * One session in a day's list, the way a timetable reads: the time and how
 * long it runs on the left, what and where in the middle, whether there's
 * room and what to do about it on the right.
 */
export function SessionRow({ id, startTime, endTime, title, meta, sub, badge, action, onOpen, highlighted, className }: SessionRowProps) {
  const duration = durationLabel(startTime, endTime);
  return (
    <div
      id={id}
      className={cn(
        "flex items-stretch gap-3 px-4 py-3.5 transition-colors sm:px-5",
        highlighted ? "bg-accent/50" : "hover:bg-muted/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card"
      >
        {/* Wide enough for "11:45am" without wrapping. */}
        <span className="w-[76px] shrink-0 border-r border-border pr-3 pt-0.5 sm:w-[86px]">
          <span className="block text-[17px] font-semibold leading-tight tabular-nums text-foreground">{formatTime(startTime)}</span>
          <span className="mt-0.5 block text-[12px] leading-tight tabular-nums text-muted-foreground">{duration || formatTime(endTime)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-foreground underline-offset-4 group-hover:underline">{title}</span>
          {meta && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{meta}</span>}
          {sub && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{sub}</span>}
        </span>
      </button>
      {/* Stacked on a phone; side by side where there is room */}
      {(badge || action) && (
        <div className="flex shrink-0 flex-col items-end justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
          {badge}
          {action}
        </div>
      )}
    </div>
  );
}

export default SessionRow;
