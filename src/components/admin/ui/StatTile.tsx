import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Draws attention: something needs doing. */
  tone?: "default" | "attention" | "good";
  onClick?: () => void;
  className?: string;
}

const TONES = {
  default: "",
  attention: "border-warning/40 bg-warning/[0.06]",
  good: "border-success/40 bg-success/[0.06]",
} as const;

/** One number worth knowing, sized for a glance on a phone. */
export function StatTile({ label, value, hint, icon, tone = "default", onClick, className }: StatTileProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>}
    </>
  );

  const classes = cn("surface p-4 text-left", TONES[tone], className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, "pressable surface-interactive w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {inner}
    </button>
  ) : (
    <div className={classes}>{inner}</div>
  );
}

/** Two across on a phone, four on a desktop. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}

export default StatTile;
