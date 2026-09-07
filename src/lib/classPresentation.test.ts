import { describe, expect, it } from "vitest";
import {
  campPriceLabel,
  classCardState,
  classDaysLabel,
  classPlanRows,
  classPriceSummary,
  distanceLabel,
  haversineDistance,
  instructorFirstName,
  isClassFull,
  joinNames,
  shortDateRange,
  termDatesLine,
} from "./classPresentation";

const childClass = {
  class_type: "children" as const,
  start_time: "17:00:00",
  end_time: "17:45:00",
  price_per_session: 8,
  price_per_term: 98.8,
  price_per_month: 27.2,
  price_per_year: 273.6,
  allow_trial: true,
  allow_monthly: true,
  allow_termly: true,
  allow_yearly: true,
};

const adultClass = {
  class_type: "adult" as const,
  start_time: "19:30:00",
  end_time: "20:30:00",
  price_per_session: 12,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
  allow_trial: false,
  allow_monthly: false,
  allow_termly: false,
  allow_yearly: false,
};

const access = { status: "confirmed", publicly_visible: true, booking_enabled: true, invite_only: false, is_active: true };

describe("instructorFirstName / distanceLabel / joinNames", () => {
  it("keeps first names only", () => {
    expect(instructorFirstName("Amie Whitaker")).toBe("Amie");
    expect(instructorFirstName("  ")).toBeNull();
    expect(instructorFirstName(null)).toBeNull();
  });
  it("rounds distances to something a parent would say", () => {
    expect(distanceLabel(0.4)).toBe("under a mile");
    expect(distanceLabel(2.34)).toBe("2.3 miles");
  });
  it("joins names the way people do", () => {
    expect(joinNames(["Maia"])).toBe("Maia");
    expect(joinNames(["Maia", "Ava"])).toBe("Maia & Ava");
    expect(joinNames(["Maia", "Ava", "Tom"])).toBe("Maia, Ava & Tom");
  });
});

describe("haversineDistance", () => {
  it("measures Kelvedon to Chelmsford in miles", () => {
    const miles = haversineDistance(51.8373, 0.701323, 51.7364, 0.4658);
    expect(miles).toBeGreaterThan(11);
    expect(miles).toBeLessThan(13);
  });
});

describe("classDaysLabel", () => {
  it("pluralises and joins several days", () => {
    expect(classDaysLabel(["monday"], "monday")).toBe("Mondays");
    expect(classDaysLabel(["monday", "wednesday"], "monday")).toBe("Mondays & Wednesdays");
    expect(classDaysLabel([], "tuesday")).toBe("Tuesdays");
    expect(classDaysLabel(null, "tuesday")).toBe("Tuesdays");
    expect(classDaysLabel(["monday", "monday"], "monday")).toBe("Mondays");
  });
});

describe("isClassFull / classCardState", () => {
  it("is full only with a capacity that is reached", () => {
    expect(isClassFull(20, 20)).toBe(true);
    expect(isClassFull(20, 7)).toBe(false);
    expect(isClassFull(0, 99)).toBe(false);
    expect(isClassFull(null, 5)).toBe(false);
  });
  it("orders invite, not-open, full, bookable", () => {
    expect(classCardState({ ...access, invite_only: true }, true)).toBe("invite");
    expect(classCardState({ ...access, booking_enabled: false }, true)).toBe("soon");
    expect(classCardState(access, true)).toBe("full");
    expect(classCardState(access, false)).toBe("bookable");
  });
});

describe("classPriceSummary", () => {
  it("leads with the membership for children and the class price for adults", () => {
    expect(classPriceSummary(childClass, 14)).toEqual({ priceLabel: "£27.20", priceHint: "/month" });
    expect(classPriceSummary(adultClass, 14)).toEqual({ priceLabel: "£12", priceHint: "per class" });
  });
  it("falls back to termly then per-class when plans are switched off", () => {
    expect(classPriceSummary({ ...childClass, allow_monthly: false }, 14)).toEqual({ priceLabel: "£98.80", priceHint: "/term" });
    expect(classPriceSummary({ ...childClass, allow_monthly: false, price_per_term: null }, 0)).toEqual({ priceLabel: "From £8", priceHint: "per class" });
    expect(classPriceSummary({ ...childClass, allow_monthly: false, allow_termly: false }, 14)).toEqual({ priceLabel: "From £8", priceHint: "per class" });
  });
});

describe("classPlanRows", () => {
  it("offers the trial only to first-time families", () => {
    expect(classPlanRows(childClass, 14, false).map((p) => p.id)).toEqual(["trial", "monthly", "term", "yearly"]);
    expect(classPlanRows(childClass, 14, true).map((p) => p.id)).toEqual(["monthly", "term", "yearly"]);
    expect(classPlanRows(childClass, 14, null).map((p) => p.id)).toEqual(["monthly", "term", "yearly"]);
  });
  it("hides termly once no sessions remain and respects the admin switches", () => {
    expect(classPlanRows(childClass, 0, true).map((p) => p.id)).toEqual(["monthly", "yearly"]);
    expect(classPlanRows({ ...childClass, allow_monthly: false, allow_yearly: false }, 3, true)).toEqual([
      { id: "term", title: "Pay for the term", meta: "All 3 sessions this term", price: "£98.80", priceSuffix: "/term" },
    ]);
  });
  it("gives adults a single pay-as-you-go row", () => {
    expect(classPlanRows(adultClass, 10, false)).toEqual([
      { id: "session", title: "Pay as you go", meta: "Pick your dates", price: "£12.00", priceSuffix: "per class" },
    ]);
  });
});

describe("shortDateRange / campPriceLabel / termDatesLine", () => {
  it("compresses date ranges", () => {
    expect(shortDateRange("2026-10-27", "2026-10-29")).toBe("27–29 Oct");
    expect(shortDateRange("2026-10-30", "2026-11-02")).toBe("30 Oct – 2 Nov");
    expect(shortDateRange("2026-10-27", "2026-10-27")).toBe("27 Oct");
    expect(shortDateRange("2026-10-27", null)).toBe("27 Oct");
    expect(shortDateRange(null, null)).toBeNull();
  });
  it("prices a camp per day or as a whole", () => {
    expect(campPriceLabel({ price_per_day: 35, price_total: 90 })).toEqual({ amount: "£35", hint: "per day" });
    expect(campPriceLabel({ price_per_day: null, price_total: 90 })).toEqual({ amount: "£90", hint: "total" });
    expect(campPriceLabel({ price_per_day: 0, price_total: null })).toBeNull();
  });
  it("writes the term as one quiet line", () => {
    expect(termDatesLine({ name: "Autumn, term 1 (2026/27)", start_date: "2026-09-01", end_date: "2026-10-23" })).toBe(
      "Autumn, term 1 · 1 Sep – 23 Oct",
    );
  });
});
