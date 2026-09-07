import { Bone } from "./Skeletons";
import { cn } from "@/lib/utils";

/** A label and a single tall field. */
export function FieldSkeleton({ className, labelWidth = "w-16" }: { className?: string; labelWidth?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      <Bone className={cn("h-3.5", labelWidth)} />
      <Bone className="h-12 w-full rounded-xl" />
    </div>
  );
}

/**
 * Shaped like Stripe's accordion Payment Element: an open "Card" item with
 * its fields, then a collapsed second method. Shown while the element loads
 * so the section does not jump when the real fields land.
 */
export function PaymentFieldsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center gap-3">
          <Bone className="h-5 w-5 rounded-full" />
          <Bone className="h-4 w-14" />
          <div className="ml-auto flex gap-1.5">
            <Bone className="h-5 w-8 rounded" />
            <Bone className="h-5 w-8 rounded" />
            <Bone className="h-5 w-8 rounded" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <FieldSkeleton labelWidth="w-24" />
          <div className="grid grid-cols-2 gap-3">
            <FieldSkeleton labelWidth="w-20" />
            <FieldSkeleton labelWidth="w-14" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Bone className="h-5 w-5 rounded-full" />
        <Bone className="h-4 w-24" />
      </div>
    </div>
  );
}

/** A numbered section heading. */
function SectionHeadingSkeleton({ width = "w-32" }: { width?: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5" aria-hidden>
      <Bone className="h-6 w-6 rounded-full" />
      <Bone className={cn("h-4", width)} />
    </div>
  );
}

/** Section 1 while the basket is still being read. */
export function BookingItemsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="surface p-5 sm:p-6" aria-hidden>
      <SectionHeadingSkeleton width="w-28" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="space-y-2">
              <Bone className="h-4 w-36" />
              <Bone className="h-3.5 w-24" />
              <Bone className="h-3.5 w-52" />
            </div>
            <Bone className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sections 2 and 3 (details + payment) while the secure form is prepared. */
export function CheckoutFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="surface p-5 sm:p-6">
        <SectionHeadingSkeleton width="w-24" />
        <div className="space-y-5">
          <FieldSkeleton labelWidth="w-12" />
          <div className="space-y-2">
            <Bone className="h-3.5 w-40" />
            <Bone className="h-[60px] w-full rounded-xl" />
          </div>
        </div>
      </div>
      <div className="surface p-5 sm:p-6">
        <SectionHeadingSkeleton width="w-20" />
        <PaymentFieldsSkeleton />
        <Bone className="mt-5 h-12 w-full rounded-xl" />
        <Bone className="mx-auto mt-4 h-3.5 w-48" />
        <Bone className="mt-5 hidden h-14 w-full rounded-xl md:block" />
      </div>
    </div>
  );
}
