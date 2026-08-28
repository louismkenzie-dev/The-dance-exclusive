import { describe, expect, it } from "vitest";
import { termOverlapsRange, termsForRange } from "./termMatching";

// The real Essex 2026-27 terms, which is where this went wrong.
const AUTUMN_1 = { id: "a1", start_date: "2026-09-01", end_date: "2026-10-23" };
const AUTUMN_2 = { id: "a2", start_date: "2026-11-02", end_date: "2026-12-18" };
const SPRING_3 = { id: "s3", start_date: "2027-01-04", end_date: "2027-02-12" };
const TERMS = [AUTUMN_1, AUTUMN_2, SPRING_3];

describe("termsForRange", () => {
  it("keeps the autumn term a Monday class starts a week into", () => {
    // The class's first Monday is the 7th; the term opened on Tuesday the 1st.
    const matched = termsForRange(TERMS, "2026-09-07", "2026-12-18");
    expect(matched.map((t) => t.id)).toEqual(["a1", "a2"]);
  });

  it("matches a term the class only partly covers", () => {
    const matched = termsForRange(TERMS, "2026-10-01", "2026-11-10");
    expect(matched.map((t) => t.id)).toEqual(["a1", "a2"]);
  });

  it("spans every term a year-long class touches", () => {
    const matched = termsForRange(TERMS, "2026-09-07", "2027-03-25");
    expect(matched.map((t) => t.id)).toEqual(["a1", "a2", "s3"]);
  });

  it("ignores terms that end before the class starts", () => {
    const matched = termsForRange(TERMS, "2026-11-02", "2026-12-18");
    expect(matched.map((t) => t.id)).toEqual(["a2"]);
  });

  it("counts a single shared day as an overlap", () => {
    expect(termOverlapsRange(AUTUMN_1, "2026-10-23", "2026-12-18")).toBe(true);
    expect(termOverlapsRange(AUTUMN_1, "2026-10-24", "2026-12-18")).toBe(false);
  });

  it("returns nothing when the class has no dates set", () => {
    expect(termsForRange(TERMS, null, "2026-12-18")).toEqual([]);
    expect(termsForRange(TERMS, "2026-09-07", null)).toEqual([]);
  });
});
