/**
 * What a freshly created booking row says about itself — who it is for,
 * when and where it happens — and the calendar event it becomes. Pure, so
 * the confirmation page and its cards can stay presentational.
 */
import { format, isSameDay, isSameMonth, isValid, parseISO } from "date-fns";
import { formatDay, formatTimeRange } from "@/lib/bookingFormat";
import { atDate, nextOccurrence, type CalendarEvent } from "@/lib/calendarLinks";

export interface ConfirmationBooking {
  id: string;
  status: string;
  booking_type: string;
  amount: number | null;
  created_at: string;
  notes: string | null;
  classes?: {
    name: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    /** Last day of the class's term: a standing booking's weekly calendar repeat ends here. */
    term_end?: string | null;
    venues?: { name: string; city: string | null } | null;
  } | null;
  camps?: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    venues?: { name: string; city: string | null } | null;
  } | null;
  students?: { first_name: string; last_name: string } | null;
}

/** Plan wording, in the journey's sentence case. The keys are the union of every booking_type seen. */
export const PLAN_LABELS: Record<string, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  monthly: "Monthly membership",
  term: "Pay for the term",
  year: "Pay for the year",
  yearly: "Pay for the year",
  pass: "Class pass",
  camp: "Holiday workshop",
  birthday: "Birthday class",
};

const BRAND = "The Dance Exclusive";

/** Camps are selected without times; the calendar entry assumes a standard day. */
export const CAMP_DAY_START = "09:00";
export const CAMP_DAY_END = "15:00";

export const bookingTitle = (b: ConfirmationBooking): string => b.classes?.name || b.camps?.name || "Class";

export const attendeeName = (b: ConfirmationBooking): string | null => {
  if (!b.students) return null;
  const name = `${b.students.first_name ?? ""} ${b.students.last_name ?? ""}`.trim();
  return name || null;
};

export const planLabelFor = (b: ConfirmationBooking): string => PLAN_LABELS[b.booking_type] || b.booking_type;

/** "Kelvedon Institute, Kelvedon" — or just the venue when the city is unknown. */
export const venueLine = (b: ConfirmationBooking): string | null => {
  const v = b.classes?.venues ?? b.camps?.venues;
  if (!v?.name) return null;
  return v.city ? `${v.name}, ${v.city}` : v.name;
};

/** Single-session bookings are stamped "… | session YYYY-MM-DD" by the server. */
const SESSION_NOTE = /\bsession (\d{4}-\d{2}-\d{2})\b/;
export const sessionDateFromNotes = (notes: string | null | undefined): string | null =>
  notes?.match(SESSION_NOTE)?.[1] ?? null;

const parseDay = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

/** "27–29 Oct", "30 Oct – 2 Nov", or "27 Oct" for a single day. */
export const formatDateRange = (start: Date, end: Date | null): string => {
  if (!end || isSameDay(start, end)) return format(start, "d MMM");
  if (isSameMonth(start, end)) return `${format(start, "d")}–${format(end, "d MMM")}`;
  return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
};

/**
 * One line saying when: "Monday 14 September · 5:45–6:45pm" for a dated
 * session, "Mondays · 5:45–6:45pm" for a standing booking, "27–29 Oct" for a camp.
 */
export const whenLine = (b: ConfirmationBooking): string | null => {
  if (b.classes) {
    const c = b.classes;
    const dated = parseDay(sessionDateFromNotes(b.notes));
    const day = dated ? format(dated, "EEEE d MMMM") : formatDay(c.day_of_week, "plural");
    const time = formatTimeRange(c.start_time, c.end_time);
    return [day, time].filter(Boolean).join(" · ") || null;
  }
  if (b.camps) {
    const start = parseDay(b.camps.start_date);
    if (!start) return null;
    return formatDateRange(start, parseDay(b.camps.end_date));
  }
  return null;
};

const withTime = (date: Date, time: string): Date => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * The calendar entry for a booking, or null when there is not enough to
 * build one (no class/camp, no times, unknown weekday). `now` anchors the
 * first occurrence of a standing booking.
 */
export const calendarEventFor = (b: ConfirmationBooking, now: Date = new Date()): CalendarEvent | null => {
  const first = b.students?.first_name?.trim();
  const title = first ? `${bookingTitle(b)} · ${first}` : bookingTitle(b);
  const location = venueLine(b);

  if (b.classes) {
    const c = b.classes;
    if (!c.start_time || !c.end_time) return null;
    const date = sessionDateFromNotes(b.notes);
    if (date) {
      return { title, start: atDate(date, c.start_time), end: atDate(date, c.end_time), location, description: BRAND };
    }
    const start = c.day_of_week ? nextOccurrence(c.day_of_week, c.start_time, now) : null;
    if (!start) return null;
    return {
      title,
      start,
      end: withTime(start, c.end_time),
      location,
      description: BRAND,
      repeatWeeklyUntil: c.term_end ?? null,
    };
  }

  if (b.camps) {
    const { start_date, end_date } = b.camps;
    if (!start_date) return null;
    return {
      title,
      start: atDate(start_date, CAMP_DAY_START),
      end: atDate(end_date ?? start_date, CAMP_DAY_END),
      location,
      description: `${BRAND}. Camp days are shown as ${CAMP_DAY_START}–${CAMP_DAY_END}; your confirmation email has the exact times.`,
    };
  }

  return null;
};
