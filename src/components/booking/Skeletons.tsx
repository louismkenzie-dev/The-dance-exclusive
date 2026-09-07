import { cn } from "@/lib/utils";

const Bone = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />
);

/** Matches ClassCard's shape so the grid does not jump when data lands. */
export function ClassCardSkeleton({ withCover = true }: { withCover?: boolean }) {
  return (
    <div className="surface overflow-hidden">
      {withCover && <Bone className="aspect-[2/1] w-full rounded-none" />}
      <div className="space-y-3 p-5">
        <Bone className="h-3 w-24" />
        <Bone className="h-5 w-2/3" />
        <Bone className="h-4 w-1/2" />
        <Bone className="h-4 w-1/3" />
        <div className="flex items-center justify-between pt-2">
          <Bone className="h-5 w-20" />
          <Bone className="h-11 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A few lines of text. */
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className={cn("h-4", i === lines - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  );
}

/** A summary panel: a few label/value rows and a total. */
export function SummarySkeleton() {
  return (
    <div className="surface space-y-4 p-5">
      <Bone className="h-4 w-28" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Bone className="h-4 w-1/2" />
          <Bone className="h-4 w-12" />
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-4">
        <Bone className="h-5 w-16" />
        <Bone className="h-6 w-20" />
      </div>
    </div>
  );
}

/** A tall block, e.g. where a payment form will mount. */
export function BlockSkeleton({ className }: { className?: string }) {
  return <Bone className={cn("h-40 w-full rounded-2xl", className)} />;
}

export { Bone };
