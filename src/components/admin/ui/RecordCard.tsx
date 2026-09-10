import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordCardProps {
  /** The one thing that identifies this row. */
  title: ReactNode;
  /** Quiet supporting lines — venue, time, who it's for. */
  meta?: ReactNode;
  /** Right-hand side: a price, a count, a status badge. */
  trailing?: ReactNode;
  /** Something square on the left — an avatar, an initial, an icon. */
  leading?: ReactNode;
  /** Buttons along the bottom. Kept out of the tap target below. */
  actions?: ReactNode;
  /** Makes the whole card a button. */
  onClick?: () => void;
  /** Shows a chevron so it reads as "this opens something". */
  chevron?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * One record as a card. This is what a table row becomes on a phone: the
 * studio runs the business from a handset at the side of a room, where a
 * six-column table is unreadable and its buttons are too small to hit.
 */
export function RecordCard({
  title,
  meta,
  trailing,
  leading,
  actions,
  onClick,
  chevron = false,
  className,
  children,
}: RecordCardProps) {
  const body = (
    <div className="flex items-start gap-3">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-snug text-foreground">{title}</div>
        {meta && <div className="mt-0.5 space-y-0.5 text-[13px] leading-relaxed text-muted-foreground">{meta}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {chevron && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );

  return (
    <div className={cn("surface overflow-hidden", className)}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="pressable block w-full px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        <div className="px-4 py-3.5">{body}</div>
      )}
      {children && <div className="border-t border-border/60 px-4 py-3">{children}</div>}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}

/** A stack of RecordCards with the right gap between them. */
export function RecordList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-2.5", className)}>{children}</div>;
}

export default RecordCard;
