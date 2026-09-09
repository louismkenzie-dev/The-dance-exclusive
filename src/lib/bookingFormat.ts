/**
 * Formatting shared by the parent booking journey, so a price, a time and a
 * day read the same on the class card, in the sheet, at checkout and on the
 * confirmation.
 */

export const formatPrice = (amount: number, opts?: { trimZeros?: boolean }): string => {
  const s = `£${Number(amount).toFixed(2)}`;
  return opts?.trimZeros ? s.replace(/\.00$/, "") : s;
};

/**
 * "17:00" → "5:00pm". The studio, its teachers and its parents all talk in
 * am/pm, so every time the app shows is written that way — the 24-hour
 * clock stays in the database and in <input type="time">, where it belongs.
 */
export const formatTime = (t?: string | null): string => {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return t;
  const h = Number(m[1]);
  const mins = m[2];
  if (!Number.isFinite(h) || h > 23) return t;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mins}${h < 12 ? "am" : "pm"}`;
};

/** "am" or "pm" for an "HH:MM", or "" when it isn't a time. */
const meridiem = (t?: string | null): string => {
  const m = /^(\d{1,2}):\d{2}/.exec((t ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  return Number.isFinite(h) && h <= 23 ? (h < 12 ? "am" : "pm") : "";
};

/**
 * "5:00–5:45pm" with an en dash; just the start when the end is missing. A
 * class that starts and finishes in the same half of the day says so once —
 * "11:30am–12:30pm" only when it actually straddles noon.
 */
export const formatTimeRange = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return formatTime(start);
  const from = formatTime(start);
  const to = formatTime(end);
  const sameHalf = meridiem(start) && meridiem(start) === meridiem(end);
  return sameHalf ? `${from.replace(/(am|pm)$/, "")}–${to}` : `${from}–${to}`;
};

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

/** "45 min", "1 hr", "1 hr 15" — how long a session runs, from its times. */
export const durationLabel = (start?: string | null, end?: string | null): string => {
  const mins = (t?: string | null) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = mins(start);
  const b = mins(end);
  if (a == null || b == null || b <= a) return "";
  const total = b - a;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m}`;
};

/** Initials for an avatar: "Maia Woods" → "MW". */
export const initialsFor = (first?: string | null, last?: string | null): string =>
  `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
