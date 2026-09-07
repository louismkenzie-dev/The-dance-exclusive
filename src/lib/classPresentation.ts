/**
 * How a class reads on a card and on its own page: the day label, the price
 * a parent compares classes by, what the one button does. Pure helpers so the
 * browser grid and the class page agree without importing each other.
 */
import { format, parseISO } from "date-fns";
import { formatDay, formatPrice } from "@/lib/bookingFormat";
import { isClassBookable, type ClassAccessFields } from "@/lib/classAudience";
import { offersMonthly, offersTermly, offersYearly, type PlanFlags } from "@/lib/classPlans";
import type { PricingPlan } from "@/contexts/CartContext";
import { monthlyPrice, sessionPrice, termPrice, trialPrice, yearlyPrice, type PricedClass } from "@/lib/pricing";

/** Public pages show instructors by first name only. */
export const instructorFirstName = (fullName: string | null | undefined): string | null =>
  (fullName ?? "").trim().split(/\s+/)[0] || null;

/** Great-circle distance in miles. */
export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** "under a mile" | "2.3 miles" */
export const distanceLabel = (miles: number): string =>
  miles < 1 ? "under a mile" : `${miles.toFixed(1)} miles`;

/** "Mondays" | "Mondays & Wednesdays" — from days_of_week, falling back to day_of_week. */
export const classDaysLabel = (days: string[] | null | undefined, fallback: string | null | undefined): string => {
  const source = days && days.length > 0 ? days : [fallback];
  const unique = [...new Set(source.filter((d): d is string => !!d))];
  return unique.map((d) => formatDay(d, "plural")).join(" & ");
};

/** Room left, given a capacity and the standing enrolment. */
export const isClassFull = (capacity: number | null | undefined, enrolled: number | null | undefined): boolean =>
  (capacity ?? 0) > 0 && (enrolled ?? 0) >= (capacity ?? 0);

export type ClassButtonState = "bookable" | "full" | "invite" | "soon";

/** What the one button on a class does. */
export const classCardState = (c: ClassAccessFields, full: boolean): ClassButtonState => {
  if (c.invite_only) return "invite";
  if (!isClassBookable(c)) return "soon";
  if (full) return "full";
  return "bookable";
};

export interface PriceSummary {
  /** "From £8" or "£27.20" */
  priceLabel: string;
  /** "per class" | "/month" | "/term" */
  priceHint: string;
}

/**
 * The headline figure a parent compares classes by: the membership price for
 * children's classes, the class price for adults.
 */
export const classPriceSummary = (c: PricedClass & PlanFlags, remainingSessions: number): PriceSummary => {
  if (c.class_type === "adult") {
    return { priceLabel: formatPrice(sessionPrice(c), { trimZeros: true }), priceHint: "per class" };
  }
  if (offersMonthly(c)) {
    return { priceLabel: formatPrice(monthlyPrice(c)), priceHint: "/month" };
  }
  if (offersTermly(c)) {
    const term = termPrice(c, remainingSessions);
    if (term != null) return { priceLabel: formatPrice(term), priceHint: "/term" };
  }
  return { priceLabel: `From ${formatPrice(sessionPrice(c), { trimZeros: true })}`, priceHint: "per class" };
};

export interface PlanRow {
  id: PricingPlan;
  title: string;
  meta: string;
  price: string;
  priceSuffix?: string;
}

/**
 * The plans a class offers, as read-only rows for its page. Mirrors the
 * booking sheet's rules exactly (trial only for first-time families, termly
 * only while sessions remain) so the page never promises a plan the sheet
 * then hides.
 */
export const classPlanRows = (
  c: PricedClass & PlanFlags & { allow_trial: boolean },
  remainingSessions: number,
  hasExistingBookings: boolean | null,
): PlanRow[] => {
  if (c.class_type === "adult") {
    return [{ id: "session", title: "Pay as you go", meta: "Pick your dates", price: formatPrice(sessionPrice(c)), priceSuffix: "per class" }];
  }
  const rows: PlanRow[] = [];
  if (c.allow_trial && hasExistingBookings === false) {
    rows.push({ id: "trial", title: "Trial class", meta: "The price of one class", price: formatPrice(trialPrice(c)) });
  }
  if (offersMonthly(c)) {
    rows.push({ id: "monthly", title: "Monthly membership", meta: "Rolling, billed on the 5th · 12th month free", price: formatPrice(monthlyPrice(c)), priceSuffix: "/month" });
  }
  if (offersTermly(c) && remainingSessions > 0) {
    const term = termPrice(c, remainingSessions);
    if (term != null) {
      rows.push({
        id: "term",
        title: "Pay for the term",
        meta: `All ${remainingSessions} ${remainingSessions === 1 ? "session" : "sessions"} this term`,
        price: formatPrice(term),
        priceSuffix: "/term",
      });
    }
  }
  if (offersYearly(c)) {
    rows.push({ id: "yearly", title: "Pay for the year", meta: "Sept–July, 38 weeks", price: formatPrice(yearlyPrice(c)), priceSuffix: "/year" });
  }
  return rows;
};

/** "27–29 Oct" | "27 Oct – 2 Nov" | "27 Oct" */
export const shortDateRange = (start: string | null | undefined, end: string | null | undefined): string | null => {
  if (!start) return null;
  try {
    const s = parseISO(start);
    if (!end || end === start) return format(s, "d MMM");
    const e = parseISO(end);
    if (format(s, "yyyy-MM") === format(e, "yyyy-MM")) return `${format(s, "d")}–${format(e, "d MMM")}`;
    return `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
  } catch {
    return null;
  }
};

/** "£35 per day" | "£90 total" — a camp's headline price. */
export const campPriceLabel = (camp: { price_per_day?: number | null; price_total?: number | null }): { amount: string; hint: string } | null => {
  if (camp.price_per_day) return { amount: formatPrice(Number(camp.price_per_day), { trimZeros: true }), hint: "per day" };
  if (camp.price_total) return { amount: formatPrice(Number(camp.price_total), { trimZeros: true }), hint: "total" };
  return null;
};

/** "Autumn, term 1 · 1 Sep – 23 Oct" */
export const termDatesLine = (t: { name: string; start_date: string; end_date: string }): string => {
  const name = t.name.replace(/\s*\(.*\)\s*$/, "");
  try {
    return `${name} · ${format(parseISO(t.start_date), "d MMM")} – ${format(parseISO(t.end_date), "d MMM")}`;
  } catch {
    return name;
  }
};

/** "Maia" | "Maia & Ava" | "Maia, Ava & Tom" */
export const joinNames = (names: string[]): string =>
  names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
