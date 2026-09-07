import { cn } from "@/lib/utils";

/**
 * A drawn tick inside a soft circle: the one moment of celebration in the
 * flow. Respects reduced motion.
 */
export function SuccessCheck({ className, size = 88 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn("animate-pop-in mx-auto flex items-center justify-center rounded-full bg-success/10", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 48 48" fill="none">
        <path
          d="M10 25.5 L20 35 L38 14"
          stroke="hsl(var(--success))"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="check-draw"
        />
      </svg>
    </div>
  );
}

export default SuccessCheck;
