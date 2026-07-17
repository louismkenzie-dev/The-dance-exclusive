// Audience / access / validation helpers for classes (September 2026 expansion).

export type ClassStatus = "confirmed" | "provisional" | "draft" | "inactive";

export const CLASS_STATUSES: ClassStatus[] = ["confirmed", "provisional", "draft", "inactive"];

export interface ClassAccessFields {
  status: string;
  publicly_visible: boolean;
  booking_enabled: boolean;
  invite_only: boolean;
  is_active: boolean;
}

export interface ClassAudienceFields {
  class_type: string;
  age_min: number | null;
  age_max: number | null;
  school_year_min: number | null;
  school_year_max: number | null;
  audience_label: string | null;
}

/** End time must be strictly after start time ("HH:MM" or "HH:MM:SS"). */
export const isValidTimeRange = (start: string, end: string): boolean => {
  const toMins = (t: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const s = toMins(start);
  const e = toMins(end);
  return s != null && e != null && e > s;
};

/** Age minimum must not exceed age maximum (nulls are allowed while unconfirmed). */
export const isValidAgeRange = (min: number | null, max: number | null): boolean =>
  min == null || max == null || min <= max;

/**
 * Human-readable audience text. The stored audience_label always wins — it
 * preserves labels like "O17" or "16+U" whose numeric meaning is unconfirmed.
 * Falls back to structured fields.
 */
export const audienceText = (c: ClassAudienceFields): string => {
  if (c.audience_label && c.audience_label.trim() !== "") return c.audience_label;
  if (c.school_year_min != null || c.school_year_max != null) {
    const min = c.school_year_min != null ? `Year ${c.school_year_min}` : "";
    const max = c.school_year_max != null ? `Year ${c.school_year_max}` : "";
    return min && max ? `${min}–${max}` : min || max;
  }
  if (c.age_min != null && c.age_max != null) return `Ages ${c.age_min}–${c.age_max}`;
  if (c.age_min != null) return `Ages ${c.age_min}+`;
  if (c.age_max != null) return `Up to age ${c.age_max}`;
  return c.class_type === "adult" ? "Adults" : "";
};

/** Consistent title-case for class names in the UI, preserving all-caps crew names (SURGE, NEXUS…). */
export const titleCaseClassName = (name: string): string =>
  name
    .split(/\s+/)
    .map((w) => {
      if (w === w.toUpperCase() && /[A-Z]/.test(w)) return w; // keep SURGE, NEXUS, O17, 16+U
      if (/^[/()&+-]+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");

/** Visible on public pages: active, explicitly public, and confirmed (never draft/provisional/inactive). */
export const isClassPubliclyVisible = (c: ClassAccessFields): boolean =>
  c.is_active && c.publicly_visible && c.status === "confirmed";

/**
 * Bookable by parents: publicly visible AND booking explicitly enabled AND
 * not invite-only. Invite-only sessions are shown with a clear message but
 * never behave like open-enrolment classes (blocker Q18 decides final UX).
 */
export const isClassBookable = (c: ClassAccessFields): boolean =>
  isClassPubliclyVisible(c) && c.booking_enabled && !c.invite_only;
