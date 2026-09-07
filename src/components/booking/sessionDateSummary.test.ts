import { describe, expect, it } from "vitest";
import { allSelected, summariseSelection } from "./sessionDateSummary";

const sessions = [
  { id: "a", date: "2026-09-14" },
  { id: "b", date: "2026-09-21" },
  { id: "c", date: "2026-09-28" },
  { id: "d", date: "2026-10-05" },
];

describe("allSelected", () => {
  it("is true only when every session is chosen", () => {
    expect(allSelected(sessions, ["a", "b", "c", "d"])).toBe(true);
    expect(allSelected(sessions, ["a", "c"])).toBe(false);
    expect(allSelected([], [])).toBe(false);
  });
});

describe("summariseSelection", () => {
  it("prompts when nothing is chosen", () => {
    expect(summariseSelection(sessions, [])).toBe("Pick your dates");
    expect(summariseSelection(sessions, [], { noun: "day" })).toBe("Pick your days");
    expect(summariseSelection(sessions, [], { empty: "Choose one date" })).toBe("Choose one date");
  });
  it("names a single date in full", () => {
    expect(summariseSelection(sessions, ["c"])).toBe("Mon 28 Sep");
  });
  it("gives a count and a range in list order, not tap order", () => {
    expect(summariseSelection(sessions, ["d", "a"])).toBe("2 dates · 14 Sep – 5 Oct");
    expect(summariseSelection(sessions, ["c", "a", "d"], { noun: "day" })).toBe("3 days · 14 Sep – 5 Oct");
  });
});
