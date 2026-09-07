import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookingPromptCardProps {
  title: string;
  body?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/**
 * A friendly nudge inside a booking sheet when something is missing before a
 * booking can go ahead ("Add your child", "Set up your profile"): what is
 * needed, why, and one quiet button. The sheet's footer stays the primary.
 */
export function BookingPromptCard({ title, body, actionLabel, onAction, className }: BookingPromptCardProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-muted/40 p-4", className)}>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {body && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>}
      <Button type="button" variant="soft" onClick={onAction} className="mt-3 h-11 rounded-xl px-4">
        {actionLabel}
      </Button>
    </div>
  );
}

export default BookingPromptCard;
