import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoticeTone = "neutral" | "brand" | "warning";

const TONE: Record<NoticeTone, string> = {
  neutral: "border-border bg-muted/50",
  brand: "border-transparent bg-accent text-accent-foreground",
  warning: "border-warning/25 bg-warning/10",
};

interface QuietNoticeProps {
  title?: ReactNode;
  children?: ReactNode;
  /** One small action on the right (wraps under on a phone). */
  action?: ReactNode;
  tone?: NoticeTone;
  className?: string;
}

/**
 * A quiet, in-flow notice — a holiday break, credits left on a pass, a
 * cancellation rule. Never a coloured wash across the page; one tinted row.
 */
export function QuietNotice({ title, children, action, tone = "neutral", className }: QuietNoticeProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5", TONE[tone], className)} role="status">
      <div className="min-w-0 flex-1 basis-56">
        {title && <p className="text-[15px] font-semibold leading-snug text-foreground">{title}</p>}
        {children && (
          <div className={cn("text-[13px] leading-relaxed", title ? "mt-0.5" : "", tone === "brand" ? "text-accent-foreground/85" : "text-muted-foreground")}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default QuietNotice;
