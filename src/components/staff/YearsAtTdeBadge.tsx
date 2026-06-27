import { differenceInYears } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface YearsAtTdeBadgeProps {
  /** The staff member's start_date (ISO string) or null. */
  startDate: string | null;
  className?: string;
}

/**
 * Small on-brand badge showing how long a staff member has been at TDE.
 * - null / empty / invalid start date  → renders nothing
 * - less than 1 full year              → "New"
 * - 1+ years                           → "{n} yrs at TDE"
 */
export function YearsAtTdeBadge({ startDate, className }: YearsAtTdeBadgeProps) {
  if (!startDate) return null;

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;

  const years = differenceInYears(new Date(), start);

  // Guard against future-dated start dates.
  if (years < 0) return null;

  const isNew = years < 1;

  return (
    <Badge
      variant="secondary"
      className={cn("whitespace-nowrap", className)}
    >
      {isNew ? "New" : `${years} yr${years === 1 ? "" : "s"} at TDE`}
    </Badge>
  );
}

export default YearsAtTdeBadge;
