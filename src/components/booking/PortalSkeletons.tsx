import { Bone } from "./Skeletons";

/** Matches a booking / membership card so the list does not jump when data lands. */
export function RecordCardSkeleton() {
  return (
    <div className="surface p-5">
      <Bone className="h-3 w-24" />
      <Bone className="mt-2.5 h-5 w-1/2" />
      <Bone className="mt-3 h-4 w-2/5" />
      <Bone className="mt-2 h-4 w-3/5" />
      <div className="mt-4 flex items-center gap-3">
        <Bone className="h-9 w-9 rounded-full" />
        <Bone className="h-4 w-28" />
      </div>
      <div className="mt-5 flex gap-2 border-t border-border/70 pt-4">
        <Bone className="h-11 w-28 rounded-full" />
        <Bone className="h-11 w-28 rounded-full" />
      </div>
    </div>
  );
}

/** A surface of list rows — timetable sessions, year rows. */
export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="surface divide-y divide-border/70 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Bone className="h-4 w-20" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3 w-1/3" />
          </div>
          <Bone className="h-9 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Rows inside a sheet while a picker loads. */
export function OptionRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
          <Bone className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-1/2" />
            <Bone className="h-3 w-2/3" />
          </div>
          <Bone className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
