import { describe, it, expect } from "vitest";
import { awardTypeLabel, previousWinsFor, summariseWins, type StudentAward } from "./awards";

const award = (over: Partial<StudentAward>): StudentAward => ({
  id: "a1",
  student_id: "s1",
  class_id: "c1",
  class_name: "Street Juniors",
  term_label: "Autumn 2025/26",
  award_type: "dancer_of_term",
  notes: null,
  awarded_on: "2025-12-12",
  ...over,
});

describe("awards history", () => {
  const all = [
    award({ id: "a1", awarded_on: "2025-12-12" }),
    award({ id: "a2", awarded_on: "2026-04-01", award_type: "most_improved", class_name: "Street Inters" }),
    award({ id: "a3", student_id: "s2", awarded_on: "2026-04-01" }),
  ];

  it("shows one dancer's wins, newest first", () => {
    const wins = previousWinsFor(all, "s1");
    expect(wins.map((w) => w.id)).toEqual(["a2", "a1"]);
  });

  it("returns nothing for a dancer who has never won", () => {
    expect(previousWinsFor(all, "nobody")).toEqual([]);
  });

  it("summarises repeat wins for a profile", () => {
    const repeat = [award({ id: "a1" }), award({ id: "a2", awarded_on: "2026-04-01" })];
    expect(summariseWins(repeat)).toEqual(["Dancer of the Term × 2"]);
    // Newest first, so the more recent Most Improved leads.
    expect(summariseWins(previousWinsFor(all, "s1"))).toEqual(["Most Improved", "Dancer of the Term"]);
  });

  it("labels award types in the studio's own words", () => {
    expect(awardTypeLabel("dancer_of_term")).toBe("Dancer of the Term");
    expect(awardTypeLabel("most_improved")).toBe("Most Improved");
    expect(awardTypeLabel("something_else")).toBe("something_else");
  });
});
