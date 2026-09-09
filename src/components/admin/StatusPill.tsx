import { cn } from "@/lib/utils";

/**
 * Small, quiet status pills for the admin booking screens — one look for a
 * booking's state wherever it is listed, and readable at a glance on a phone.
 */

const BOOKING_STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-success/15 text-[hsl(var(--success-strong))]" },
  pending_payment: { label: "Awaiting payment", className: "bg-warning/15 text-[hsl(var(--warning-strong))]" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = BOOKING_STATUS[status] ?? { label: status.replace(/_/g, " "), className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/** A tinted pill with its own wording — "Attended", "No show", "Converted". */
export function TonePill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "destructive" | "primary";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-[hsl(var(--success-strong))]",
    warning: "bg-warning/15 text-[hsl(var(--warning-strong))]",
    destructive: "bg-destructive/15 text-[hsl(var(--destructive-strong))]",
    primary: "bg-primary/15 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  session: "Pay as you go",
  drop_in: "Pay as you go",
  term: "Termly",
  yearly: "Yearly",
  monthly: "Monthly",
  camp: "Camp",
  pass: "Class pass",
  birthday: "Birthday class",
};

/** "trial" → "Trial", "session" → "Pay as you go". */
export const planLabel = (bookingType: string) => PLAN_LABEL[bookingType] ?? bookingType.replace(/_/g, " ");

export default StatusPill;
