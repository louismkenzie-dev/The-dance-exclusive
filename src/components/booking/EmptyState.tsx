import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Show a red tint for failures. */
  tone?: "neutral" | "error";
}

/**
 * A deliberate empty / error / nothing-here state: what happened, in plain
 * words, and one obvious next action. Typographic, no illustration.
 */
export function EmptyState({ title, body, action, className, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className={cn("surface px-6 py-12 text-center sm:py-16", className)}>
      <div
        className={cn(
          "mx-auto mb-4 h-1.5 w-10 rounded-full",
          tone === "error" ? "bg-destructive/60" : "bg-primary/50",
        )}
        aria-hidden
      />
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export default EmptyState;
