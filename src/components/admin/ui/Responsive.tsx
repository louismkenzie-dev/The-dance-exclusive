import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The table-or-cards pair. A screen renders both and lets the breakpoint
 * choose: cards for a thumb, the table for a desk. Using these instead of
 * bare `sm:hidden` keeps the intent legible and the breakpoint in one place.
 */
export function PhoneOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sm:hidden", className)}>{children}</div>;
}

export function DesktopOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hidden sm:block", className)}>{children}</div>;
}
