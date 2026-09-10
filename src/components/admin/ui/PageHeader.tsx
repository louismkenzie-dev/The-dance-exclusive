import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** One quiet line saying what the screen is for. */
  subtitle?: ReactNode;
  /** A count that belongs to the title — "142" next to "Customers". */
  count?: number | string | null;
  /** The screen's primary action. Hidden on phones when a Fab carries it. */
  action?: ReactNode;
  /** Hide the action on phones (because a Fab shows it instead). */
  actionDesktopOnly?: boolean;
  className?: string;
}

/**
 * The top of an admin screen: what it is, what it's for, and the one thing
 * you most likely came to do. Sentence case in the body face — the admin
 * used to shout its titles in condensed uppercase, which read like a
 * marketing site rather than the tool it is.
 */
export function PageHeader({
  title,
  subtitle,
  count,
  action,
  actionDesktopOnly = false,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          <span className="truncate">{title}</span>
          {count != null && count !== "" && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </h1>
        {subtitle && <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className={cn("shrink-0", actionDesktopOnly && "hidden sm:block")}>{action}</div>}
    </div>
  );
}

export default PageHeader;
