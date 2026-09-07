import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PaymentErrorNoticeProps {
  title: string;
  /** Plain-English explanation, or the server's own customer-facing text. */
  body?: ReactNode;
  /** The raw message, when the body is only a translation of it. */
  detail?: string;
  /** Red for a failure; amber for "one more thing before you can pay". */
  tone?: "error" | "warning";
  /** Fix-it actions: a form, a button. */
  children?: ReactNode;
  className?: string;
}

/**
 * The designed surface for anything that stops a payment: what happened,
 * in plain words, with the real detail kept underneath. No icon — a single
 * coloured rule on the left carries the tone.
 */
export function PaymentErrorNotice({ title, body, detail, tone = "error", children, className }: PaymentErrorNoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card py-4 pl-5 pr-4",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        tone === "error" ? "before:bg-destructive" : "before:bg-warning",
        className,
      )}
    >
      <p className="text-[15px] font-semibold leading-snug text-foreground">{title}</p>
      {body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {detail && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/80">{detail}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default PaymentErrorNotice;
