import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  /** Left side: a price, a summary line, a step hint. */
  children?: ReactNode;
  /** Right side: the one primary action. */
  action: ReactNode;
  className?: string;
  /** Keep it visible on desktop too (default: phone only). */
  showOnDesktop?: boolean;
}

/**
 * The thumb-reach action bar pinned to the bottom of a phone screen. Pages
 * that use it hide the tab bar, so the primary action is never competing
 * with navigation for the same strip of glass.
 */
export function StickyActionBar({ children, action, className, showOnDesktop = false }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-safe",
        !showOnDesktop && "md:hidden",
        className,
      )}
    >
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}

/** Spacer so page content is never hidden behind the bar. */
export function StickyActionBarSpacer({ showOnDesktop = false }: { showOnDesktop?: boolean }) {
  return <div className={cn("h-24", !showOnDesktop && "md:hidden")} aria-hidden />;
}

export default StickyActionBar;
