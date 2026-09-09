import type { MouseEvent, ReactNode } from "react";
import type { Availability } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";
import { AvailabilityPill } from "./AvailabilityPill";

export type ClassCardState = "bookable" | "full" | "invite" | "soon";

export interface ClassCardData {
  id: string;
  name: string;
  /** "Street", "Hip Hop" */
  style?: string | null;
  /** "Mondays" */
  dayLabel: string;
  /** "5:00–5:45pm" */
  timeLabel: string;
  venue?: string | null;
  /** "Ages 3–7", "Year 2–Year 6", "Adults" */
  audience?: string | null;
  instructor?: string | null;
  /** "From £8" or "£27.20" */
  priceLabel: string;
  /** "per class", "/month" */
  priceHint?: string | null;
  availability: Availability;
  coverUrl?: string | null;
  coverPosition?: string | null;
  /** Children on the account this class suits. */
  matchedNames?: string[];
  state: ClassCardState;
  onWaitlist?: boolean;
}

interface ClassCardProps {
  data: ClassCardData;
  /** Tap on the card body. */
  onOpen?: () => void;
  /** The one primary action (Book / Join waitlist). */
  onPrimary?: () => void;
  primaryLabel?: string;
  busy?: boolean;
  highlighted?: boolean;
  /** Extra content under the meta (rarely needed). */
  children?: ReactNode;
  className?: string;
}

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

/**
 * A class as a product: name, when, where, who it's for, what it costs,
 * whether there's room, one button. Nothing else.
 */
export function ClassCard({ data, onOpen, onPrimary, primaryLabel, busy, highlighted, children, className }: ClassCardProps) {
  const cta =
    primaryLabel ??
    (data.state === "full" ? (data.onWaitlist ? "On waitlist" : "Join waitlist")
      : data.state === "invite" ? "Invite only"
      : data.state === "soon" ? "Coming soon"
      : "Book");
  const ctaDisabled = busy || data.state === "invite" || data.state === "soon";
  const ctaTone = data.state === "bookable" ? "primary" : "soft";

  const handlePrimary = (e: MouseEvent) => {
    e.stopPropagation();
    onPrimary?.();
  };

  return (
    <article
      id={`class-${data.id}`}
      className={cn(
        "surface surface-interactive group relative flex flex-col overflow-hidden",
        onOpen && "cursor-pointer",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      onClick={onOpen}
      tabIndex={onOpen ? 0 : undefined}
      role={onOpen ? "link" : undefined}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      aria-label={onOpen ? `${data.name}, ${data.dayLabel} ${data.timeLabel}` : undefined}
    >
      {data.coverUrl && (
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted">
          <img
            src={data.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            style={{ objectPosition: data.coverPosition ?? "50% 30%" }}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">
            {[data.style, data.audience].filter(Boolean).join(" · ")}
          </p>
          {data.matchedNames && data.matchedNames.length > 0 && (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
              Suits {joinNames(data.matchedNames)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{data.name}</h3>

        <p className="mt-2 text-[15px] text-foreground/90">
          {data.dayLabel} · {data.timeLabel}
        </p>
        <p className="mt-0.5 text-[15px] text-muted-foreground">
          {[data.venue, data.instructor ? `with ${data.instructor}` : null].filter(Boolean).join(" · ")}
        </p>

        {children}

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/70 pt-4">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tabular-nums text-foreground">
              {data.priceLabel}
              {data.priceHint && <span className="ml-1 text-[13px] font-normal text-muted-foreground">{data.priceHint}</span>}
            </p>
            <AvailabilityPill availability={data.availability} className="mt-1" />
          </div>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={ctaDisabled}
            className={cn(
              "pressable inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-60",
              ctaTone === "primary"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {busy ? "…" : cta}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ClassCard;
