import { describe, it, expect } from "vitest";
import {
  slugify,
  isNamedVenue,
  isVenuePubliclyListable,
  featuredVenuesForDisplay,
  venueCardImage,
  VENUE_FALLBACK_IMAGE,
} from "./venuePresentation";

const venue = (overrides: Partial<Parameters<typeof isVenuePubliclyListable>[0]> = {}) => ({
  status: "confirmed",
  publicly_visible: true,
  is_featured: false,
  featured_order: null,
  name: "Test Venue",
  ...overrides,
});

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("Kelvedon Institute")).toBe("kelvedon-institute");
    expect(slugify("Bolford Hall, Thaxted")).toBe("bolford-hall-thaxted");
    expect(slugify("  Coval Lane / Chelmsford Theatre  ")).toBe("coval-lane-chelmsford-theatre");
  });
});

describe("isVenuePubliclyListable", () => {
  it("lists confirmed public venues", () => {
    expect(isVenuePubliclyListable(venue())).toBe(true);
  });
  it("excludes hidden venues", () => {
    expect(isVenuePubliclyListable(venue({ publicly_visible: false }))).toBe(false);
  });
  it("excludes inactive venues even when marked visible", () => {
    expect(isVenuePubliclyListable(venue({ status: "inactive" }))).toBe(false);
  });
  it("excludes provisional venues unless explicitly made visible", () => {
    expect(isVenuePubliclyListable(venue({ status: "provisional", publicly_visible: false }))).toBe(false);
    // explicit admin opt-in
    expect(isVenuePubliclyListable(venue({ status: "provisional", publicly_visible: true }))).toBe(true);
  });
  it("excludes a venue that has never been named", () => {
    expect(isVenuePubliclyListable(venue({ name: "" }))).toBe(false);
    expect(isVenuePubliclyListable(venue({ name: "   " }))).toBe(false);
  });
});

describe("isNamedVenue", () => {
  it("accepts a real name and rejects an unfilled one", () => {
    expect(isNamedVenue({ name: "Kelvedon Institute" })).toBe(true);
    expect(isNamedVenue({ name: "" })).toBe(false);
    expect(isNamedVenue({ name: "  " })).toBe(false);
    expect(isNamedVenue({ name: null })).toBe(false);
    expect(isNamedVenue({ name: undefined })).toBe(false);
  });
});

describe("featuredVenuesForDisplay", () => {
  it("returns only featured, publicly listable venues in deterministic order", () => {
    const venues = [
      venue({ name: "C", is_featured: true, featured_order: 2 }),
      venue({ name: "A", is_featured: true, featured_order: 1 }),
      venue({ name: "Hidden", is_featured: true, featured_order: 0, publicly_visible: false }),
      venue({ name: "Provisional", is_featured: true, featured_order: 0, status: "provisional", publicly_visible: false }),
      venue({ name: "NotFeatured", is_featured: false }),
      venue({ name: "B-no-order", is_featured: true, featured_order: null }),
      venue({ name: "A-no-order", is_featured: true, featured_order: null }),
    ];
    expect(featuredVenuesForDisplay(venues).map((v) => v.name)).toEqual([
      "A",
      "C",
      "A-no-order", // null orders come last, alphabetical tiebreak
      "B-no-order",
    ]);
  });

  it("handles fewer than three featured venues gracefully", () => {
    expect(featuredVenuesForDisplay([venue({ is_featured: true })])).toHaveLength(1);
    expect(featuredVenuesForDisplay([])).toEqual([]);
  });
});

describe("venueCardImage", () => {
  it("returns the first available image", () => {
    expect(venueCardImage(null, "outside.jpg")).toBe("outside.jpg");
    expect(venueCardImage("hero.jpg", "outside.jpg")).toBe("hero.jpg");
  });
  it("falls back to the placeholder when nothing is mapped", () => {
    expect(venueCardImage(null, undefined, "")).toBe(VENUE_FALLBACK_IMAGE);
  });
});
