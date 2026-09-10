import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FabProps {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Keep it on desktop too. By default it is a phone-only affordance. */
  showOnDesktop?: boolean;
}

/**
 * The screen's primary action, parked in the bottom-right where a thumb
 * already is. Phones only by default — on a desktop the same action sits in
 * the page header, where there is room for it.
 */
export function Fab({ onClick, children, icon, className, showOnDesktop = false }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        !showOnDesktop && "sm:hidden",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export default Fab;
