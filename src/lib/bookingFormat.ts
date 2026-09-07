/**
 * Formatting shared by the parent booking journey, so a price, a time and a
 * day read the same on the class card, in the sheet, at checkout and on the
 * confirmation.
 */

export const formatPrice = (amount: number, opts?: { trimZeros?: boolean }): string => {
  const s = `£${Number(amount).toFixed(2)}`;
  return opts?.trimZeros ? s.replace(/\.00$/, "") : s;
};

export const formatTime = (t?: string | null): string => (t ? t.slice(0, 5) : "");

/** "17:00–17:45" with an en dash; just the start when the end is missing. */
export const formatTimeRange = (start?: string | null, end?: string | null): string =>
  start && end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);

const DAY_LONG: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

/** "monday" → "Monday" | "Mondays" | "Mon". */
export const formatDay = (day?: string | null, style: "long" | "plural" | "short" = "long"): string => {
  if (!day) return "";
  const long = DAY_LONG[day.toLowerCase()] ?? day.charAt(0).toUpperCase() + day.slice(1);
  if (style === "short") return long.slice(0, 3);
  if (style === "plural") return `${long}s`;
  return long;
};

export type AvailabilityTone = "open" | "low" | "full" | "closed";

export interface Availability {
  tone: AvailabilityTone;
  label: string;
  /** Spaces left, when the class has a capacity. */
  left: number | null;
}

/**
 * Human wording for remaining capacity. Plenty of room is simply "Spaces
 * available"; the number only appears once it is worth knowing.
 */
export const availabilityFor = (capacity: number | null | undefined, enrolled: number | null | undefined): Availability => {
  if (!capacity || capacity <= 0) return { tone: "open", label: "Spaces available", left: null };
  const left = Math.max(0, capacity - (enrolled ?? 0));
  if (left === 0) return { tone: "full", label: "Fully booked", left };
  if (left === 1) return { tone: "low", label: "Only 1 space left", left };
  if (left <= 3) return { tone: "low", label: `Only ${left} left`, left };
  if (left <= 7) return { tone: "open", label: `${left} spaces left`, left };
  return { tone: "open", label: "Spaces available", left };
};

/** Initials for an avatar: "Maia Woods" → "MW". */
export const initialsFor = (first?: string | null, last?: string | null): string =>
  `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
