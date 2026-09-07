import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type QuietPillTone = "neutral" | "brand" | "success" | "warning" | "destructive";

const TONE: Record<QuietPillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-accent text-accent-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * A quiet status pill — "Pending payment", "Payment issue", "Now". Only for
 * states worth flagging; the ordinary, expected state needs no badge.
 */
export function QuietPill({ tone = "neutral", children, className }: { tone?: QuietPillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium leading-none", TONE[tone], className)}>
      {children}
    </span>
  );
}

export default QuietPill;
