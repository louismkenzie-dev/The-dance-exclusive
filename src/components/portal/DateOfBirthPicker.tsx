import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DateOfBirthPickerProps {
  /** yyyy-MM-dd, or "" when nothing is selected. */
  value: string;
  onChange: (v: string) => void;
  /** Inclusive year range for the Year select (rendered descending). Defaults to the last 100 years. */
  minYear?: number;
  maxYear?: number;
  /** Applied to the Day select trigger, so a <Label htmlFor> can target the field. */
  id?: string;
  className?: string;
  /**
   * Extra class for the three Select popovers. They portal to document.body,
   * so pass the theme wrapper class (e.g. "theme-children" / "theme-adult")
   * to keep the dropdowns on-brand inside themed dialogs.
   */
  popoverClassName?: string;
}

interface Parts {
  day: number | null;
  month: number | null;
  year: number | null;
}

const parseValue = (value: string): Parts => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return { day: null, month: null, year: null };
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
};

/** month is 1-12. Falls back to a leap year when the year is unknown so 29 Feb stays selectable. */
const daysInMonth = (year: number | null, month: number | null) =>
  month == null ? 31 : new Date(year ?? 2000, month, 0).getDate();

const toValue = ({ day, month, year }: Parts) =>
  day != null && month != null && year != null
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : "";

/**
 * Fast date-of-birth entry for parents: three dropdowns (Day / Month / Year)
 * instead of a calendar to page through. Controlled on a yyyy-MM-dd string —
 * emits onChange once all three parts are chosen, and clamps the day when a
 * month/year change shrinks the month (e.g. 31 Jan -> Feb becomes 28/29 Feb).
 */
const DateOfBirthPicker = ({ value, onChange, minYear, maxYear, id, className, popoverClassName }: DateOfBirthPickerProps) => {
  const currentYear = new Date().getFullYear();
  const yearMax = maxYear ?? currentYear;
  const yearMin = minYear ?? currentYear - 100;

  const [parts, setParts] = useState<Parts>(() => parseValue(value));

  // Re-sync when the controlled value changes from outside (e.g. the form resets).
  useEffect(() => {
    setParts((prev) => (toValue(prev) === value ? prev : parseValue(value)));
  }, [value]);

  const setPart = (patch: Partial<Parts>) => {
    const next = { ...parts, ...patch };
    // Clamp the day if the newly selected month/year has fewer days.
    const max = daysInMonth(next.year, next.month);
    if (next.day != null && next.day > max) next.day = max;
    setParts(next);
    const emitted = toValue(next);
    if (emitted && emitted !== value) onChange(emitted);
  };

  const days = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => i + 1);
  const years = Array.from({ length: Math.max(yearMax - yearMin + 1, 1) }, (_, i) => yearMax - i);

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] gap-2", className)}>
      <Select value={parts.day != null ? String(parts.day) : ""} onValueChange={(v) => setPart({ day: Number(v) })}>
        <SelectTrigger id={id} aria-label="Day of birth">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent className={popoverClassName}>
          {days.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={parts.month != null ? String(parts.month) : ""} onValueChange={(v) => setPart({ month: Number(v) })}>
        <SelectTrigger aria-label="Month of birth">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent className={popoverClassName}>
          {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={parts.year != null ? String(parts.year) : ""} onValueChange={(v) => setPart({ year: Number(v) })}>
        <SelectTrigger aria-label="Year of birth">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className={popoverClassName}>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DateOfBirthPicker;
