import { describe, it, expect } from "vitest";
import {
  AGE_BANDS,
  applyClassFilters,
  daysOf,
  hasActiveFilters,
  matchesAgeBand,
  matchesSearch,
  NO_FILTERS,
  type FilterableClass,
} from "./classFilters";

const band = (id: string) => AGE_BANDS.find((b) => b.id === id)!;

const streetJuniors: FilterableClass = {
  name: "Street Juniors",
  dance_style: "Street",
  age_min: 7,
  age_max: 9,
  day_of_week: "wednesday",
  days_of_week: ["wednesday"],
  venue_id: "v1",
  venues: { name: "Kelvedon Village Hall", city: "Kelvedon" },
};

const adultCommercial: FilterableClass = {
  name: "Adult Commercial",
  dance_style: "Commercial",
  age_min: 16,
  age_max: null,
  day_of_week: "monday",
  days_of_week: ["monday", "thursday"],
  venue_id: "v2",
  venues: { name: "Braintree Studio", city: "Braintree" },
};

const anyAge: FilterableClass = {
  name: "Family Freestyle",
  age_min: null,
  age_max: null,
  day_of_week: "saturday",
  days_of_week: null,
  venue_id: "v1",
  venues: { name: "Kelvedon Village Hall", city: "Kelvedon" },
};

describe("class browser filters", () => {
  it("shows a class in every age band its range overlaps", () => {
    // 7–9 year olds straddle the 5–7 and 8–11 bands.
    expect(matchesAgeBand(streetJuniors, band("5-7"))).toBe(true);
    expect(matchesAgeBand(streetJuniors, band("8-11"))).toBe(true);
    expect(matchesAgeBand(streetJuniors, band("2-4"))).toBe(false);
    expect(matchesAgeBand(streetJuniors, band("12-16"))).toBe(false);
  });

  it("treats an open-ended upper age as reaching the top band", () => {
    expect(matchesAgeBand(adultCommercial, band("17+"))).toBe(true);
    expect(matchesAgeBand(adultCommercial, band("12-16"))).toBe(true);
    expect(matchesAgeBand(adultCommercial, band("8-11"))).toBe(false);
  });

  it("never hides a class that has no age range set", () => {
    for (const b of AGE_BANDS) expect(matchesAgeBand(anyAge, b)).toBe(true);
  });

  it("reads every day a class runs on, old column or new", () => {
    expect(daysOf(adultCommercial)).toEqual(["monday", "thursday"]);
    expect(daysOf(anyAge)).toEqual(["saturday"]);
    expect(daysOf({ name: "x", days_of_week: [], day_of_week: null })).toEqual([]);
  });

  it("searches the things a parent would actually type", () => {
    expect(matchesSearch(streetJuniors, "street")).toBe(true);
    expect(matchesSearch(streetJuniors, "kelvedon")).toBe(true);
    expect(matchesSearch(streetJuniors, "wed")).toBe(true);
    expect(matchesSearch(streetJuniors, "ballet")).toBe(false);
    expect(matchesSearch(streetJuniors, "   ")).toBe(true);
  });

  it("combines venue, age, day and search", () => {
    const all = [streetJuniors, adultCommercial, anyAge];
    expect(applyClassFilters(all, NO_FILTERS)).toHaveLength(3);
    expect(applyClassFilters(all, { ...NO_FILTERS, venueId: "v1" })).toEqual([streetJuniors, anyAge]);
    expect(applyClassFilters(all, { ...NO_FILTERS, ageBandId: "8-11" })).toEqual([streetJuniors, anyAge]);
    expect(applyClassFilters(all, { ...NO_FILTERS, day: "thursday" })).toEqual([adultCommercial]);
    expect(applyClassFilters(all, { ...NO_FILTERS, venueId: "v1", day: "saturday" })).toEqual([anyAge]);
    expect(applyClassFilters(all, { ...NO_FILTERS, search: "commercial" })).toEqual([adultCommercial]);
  });

  it("knows when anything is filtered, so the reset can be offered", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, search: "  " })).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, day: "monday" })).toBe(true);
  });
});
