/**
 * Narrowing a long timetable down to the handful of classes a family could
 * actually book.
 *
 * The class list had grown to the point where parents said it was hard to tell
 * one class from another at a glance. Venue chips already existed; what was
 * missing was the two questions a parent actually asks — "which of these suit
 * my child's age?" and "which run on a day we're free?" — plus a plain search.
 */

export interface FilterableClass {
  name: string;
  dance_style?: string | null;
  audience_label?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  day_of_week?: string | null;
  days_of_week?: string[] | null;
  venue_id?: string | null;
  venues?: { name?: string | null; city?: string | null } | null;
}

export interface AgeBand {
  /** Stable value used by the chip. */
  id: string;
  label: string;
  min: number;
  /** Inclusive upper bound; Infinity for the open-ended top band. */
  max: number;
}

/** The bands the studio thinks in — pre-school, primary, seniors, adults. */
export const AGE_BANDS: AgeBand[] = [
  { id: "2-4", label: "2–4 yrs", min: 2, max: 4 },
  { id: "5-7", label: "5–7 yrs", min: 5, max: 7 },
  { id: "8-11", label: "8–11 yrs", min: 8, max: 11 },
  { id: "12-16", label: "12–16 yrs", min: 12, max: 16 },
  { id: "17+", label: "17+", min: 17, max: Infinity },
];

export const DAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;
export type Day = (typeof DAYS)[number];

export const dayLabel = (day: string) => day.charAt(0).toUpperCase() + day.slice(1, 3);

/** Every day a class runs on, tolerating the older single-day column. */
export function daysOf(cls: FilterableClass): string[] {
  const many = (cls.days_of_week ?? []).filter(Boolean);
  if (many.length > 0) return many.map((d) => d.toLowerCase());
  return cls.day_of_week ? [cls.day_of_week.toLowerCase()] : [];
}

/**
 * Does a class's age range overlap the band at all? A class for 7–9s belongs
 * under both "5–7" and "8–11" — a parent looking at either should see it.
 * A class with no age range set is shown in every band rather than hidden.
 */
export function matchesAgeBand(cls: FilterableClass, band: AgeBand): boolean {
  const min = cls.age_min ?? null;
  const max = cls.age_max ?? null;
  if (min == null && max == null) return true;
  const low = min ?? 0;
  const high = max ?? Infinity;
  return low <= band.max && high >= band.min;
}

/** Free-text match over the things a parent would type. */
export function matchesSearch(cls: FilterableClass, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    cls.name,
    cls.dance_style,
    cls.audience_label,
    cls.venues?.name,
    cls.venues?.city,
    ...daysOf(cls),
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

export interface ClassFilters {
  venueId: string;
  ageBandId: string;
  day: string;
  search: string;
}

export const NO_FILTERS: ClassFilters = {
  venueId: "all",
  ageBandId: "all",
  day: "all",
  search: "",
};

export const hasActiveFilters = (filters: ClassFilters): boolean =>
  filters.venueId !== "all" ||
  filters.ageBandId !== "all" ||
  filters.day !== "all" ||
  filters.search.trim() !== "";

/** Apply every filter at once. */
export function applyClassFilters<T extends FilterableClass>(
  classes: T[],
  filters: ClassFilters,
): T[] {
  const band = AGE_BANDS.find((b) => b.id === filters.ageBandId) ?? null;
  return classes.filter((cls) => {
    if (filters.venueId !== "all" && cls.venue_id !== filters.venueId) return false;
    if (band && !matchesAgeBand(cls, band)) return false;
    if (filters.day !== "all" && !daysOf(cls).includes(filters.day)) return false;
    return matchesSearch(cls, filters.search);
  });
}
