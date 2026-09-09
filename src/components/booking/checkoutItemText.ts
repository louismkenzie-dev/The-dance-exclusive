/**
 * The one or two quiet lines under a basket item at checkout. Pure, so the
 * odd shapes in the basket (camps carry their first day as the day of week,
 * passes carry 00:00 times) are handled in one tested place.
 */
import { cartItemKind, type CartItem, type PricingPlan } from "@/contexts/CartContext";
import { formatDay, formatTimeRange } from "@/lib/bookingFormat";

export const CHECKOUT_PLAN_LABEL: Record<PricingPlan, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  monthly: "Monthly membership",
  term: "Pay for the term",
  yearly: "Pay for the year",
  pass: "Class pass",
};

type ItemText = Pick<
  CartItem,
  "itemKind" | "dayOfWeek" | "startTime" | "endTime" | "venueName" | "pricingPlan" | "sessionsCount" | "selectedSessionDates"
>;

const MAX_DATES = 3;

/** "14 Sep, 21 Sep, 28 Sep" or "14 Sep, 21 Sep, 28 Sep +2 more". */
export const summariseDates = (dates: string[] | undefined | null, max = MAX_DATES): string => {
  const list = (dates ?? []).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} +${list.length - max} more`;
};

/** "Mondays · 5:00–5:45pm · Kelvedon Institute". */
export const scheduleLine = (item: ItemText): string => {
  const kind = cartItemKind(item);
  if (kind === "pass") return "";
  const time = formatTimeRange(item.startTime, item.endTime);
  const parts: string[] = [];
  if (kind === "camp") {
    const dates = summariseDates(item.selectedSessionDates);
    if (dates) parts.push(dates);
  } else {
    const day = formatDay(item.dayOfWeek, "plural");
    if (day) parts.push(day);
  }
  if (time && time !== "00:00–00:00" && time !== "00:00") parts.push(time);
  if (item.venueName) parts.push(item.venueName);
  return parts.join(" · ");
};

/** "Trial class · 14 Sep", "Pay as you go · 3 classes · 14 Sep, 21 Sep, 28 Sep", "Class pass · 4 classes". */
export const planLine = (item: ItemText): string => {
  const kind = cartItemKind(item);
  const parts: string[] = [CHECKOUT_PLAN_LABEL[item.pricingPlan] ?? item.pricingPlan];
  if (kind === "camp") {
    const days = item.sessionsCount ?? item.selectedSessionDates?.length ?? 0;
    if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }
  if (kind === "pass") {
    if (item.sessionsCount) parts.push(`${item.sessionsCount} class${item.sessionsCount === 1 ? "" : "es"}`);
    return parts.join(" · ");
  }
  if (item.pricingPlan === "session" || item.pricingPlan === "trial") {
    const count = item.sessionsCount ?? item.selectedSessionDates?.length ?? 0;
    if (item.pricingPlan === "session" && count > 1) parts.push(`${count} classes`);
    const dates = summariseDates(item.selectedSessionDates);
    if (dates) parts.push(dates);
  }
  return parts.join(" · ");
};
