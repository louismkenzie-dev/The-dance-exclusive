import { describe, it, expect } from "vitest";
import { MERCH_CATEGORIES, merchCategoryLabel, merchCategoryOrder } from "./merchCategories";

describe("merchCategories", () => {
  it("gives every canonical category a label", () => {
    for (const c of MERCH_CATEGORIES) {
      expect(c.label).toBeTruthy();
      expect(c.label).not.toBe(c.value);
    }
  });

  it("has no duplicate slugs", () => {
    const values = MERCH_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  // The regression test for the bug this module exists to fix: the shop kept its own map spelled
  // "hoodies"/"t-shirts" while the admin wrote "hoodie"/"t-shirt", so every live product fell
  // through to the raw slug. These are the categories actually in use on the live catalogue.
  it.each(["t-shirt", "hoodie", "dance-pants", "other"])(
    "labels the live category %s without showing the slug",
    (slug) => {
      const label = merchCategoryLabel(slug);
      expect(label).not.toBe(slug);
      // A raw slug is lower-case; a label is not. ("T-Shirts" keeps its hyphen, and should.)
      expect(label).not.toBe(label.toLowerCase());
    },
  );

  it("title-cases an unknown slug rather than showing it raw", () => {
    expect(merchCategoryLabel("leg-warmers")).toBe("Leg Warmers");
    expect(merchCategoryLabel("tutu")).toBe("Tutu");
  });

  it("falls back to Other for a missing category", () => {
    expect(merchCategoryLabel(null)).toBe("Other");
    expect(merchCategoryLabel(undefined)).toBe("Other");
    expect(merchCategoryLabel("")).toBe("Other");
  });

  it("orders known categories canonically and unknown ones last", () => {
    expect(merchCategoryOrder("t-shirt")).toBeLessThan(merchCategoryOrder("other"));
    expect(merchCategoryOrder("mystery")).toBe(MERCH_CATEGORIES.length);
  });
});
