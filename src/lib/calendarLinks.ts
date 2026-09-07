/**
 * "Add to calendar" links for a booking: a Google Calendar URL and an .ics
 * file (Apple, Outlook). Built client-side from what the confirmation page
 * already knows; nothing is fetched.
 */

export interface CalendarEvent {
  title: string;
  /** Local start/end. */
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
  /** Weekly repeat until this date (YYYY-MM-DD), for standing bookings. */
  repeatWeeklyUntil?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 20260914T170000 in local time (floating), which every calendar app treats as the device's zone. */
const stampLocal = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

/** 20260914T160000Z in UTC, for Google's URL. */
const stampUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const rrule = (until?: string | null) => (until ? `RRULE:FREQ=WEEKLY;UNTIL=${until.replace(/-/g, "")}T235959` : null);

export const googleCalendarUrl = (ev: CalendarEvent): string => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${stampUtc(ev.start)}/${stampUtc(ev.end)}`,
  });
  if (ev.location) params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);
  const rule = rrule(ev.repeatWeeklyUntil);
  if (rule) params.set("recur", rule);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildIcs = (ev: CalendarEvent): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Dance Exclusive//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${stampLocal(ev.start)}-${Math.random().toString(36).slice(2)}@thedanceexclusive.co.uk`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART:${stampLocal(ev.start)}`,
    `DTEND:${stampLocal(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
  ];
  if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
  const rule = rrule(ev.repeatWeeklyUntil);
  if (rule) lines.push(rule);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
};

export const icsDataUrl = (ev: CalendarEvent): string =>
  `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(ev))}`;

const DOW: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

/**
 * The next occurrence of a weekday at a given time, from today. For a
 * standing booking this is the first calendar entry; the repeat rule does the rest.
 */
export const nextOccurrence = (dayOfWeek: string, time: string, from: Date = new Date()): Date | null => {
  const target = DOW[dayOfWeek.toLowerCase()];
  if (target == null) return null;
  const [h, m] = time.split(":").map(Number);
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() < from.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
};

/** A dated session: YYYY-MM-DD plus HH:MM(:SS). */
export const atDate = (date: string, time: string): Date => {
  const [y, mo, da] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(y, mo - 1, da, h, m, 0, 0);
};
