import { describe, expect, it } from "vitest";
import { groupSessionsByTerm, OUTSIDE_TERM_LABEL } from "./termGrouping";

const TERMS = [
  { name: "Autumn Term 2026", start_date: "2026-09-01", end_date: "2026-12-18" },
  { name: "Spring Term 2027", start_date: "2027-01-04", end_date: "2027-03-26" },
];
const HOLIDAYS = [
  { name: "October half term", start_date: "2026-10-26", end_date: "2026-10-30" },
  { name: "Christmas holidays", start_date: "2026-12-21", end_date: "2027-01-01" },
];

const dates = (ds: string[]) => ds.map((d) => ({ d }));
const dateOf = (s: { d: string }) => s.d;

describe("groupSessionsByTerm", () => {
  it("splits a term into blocks at the half-term break", () => {
    // Mondays: 7 before half term (26–30 Oct), 6 after.
    const mondays = [
      "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
      "2026-10-05", "2026-10-12", "2026-10-19",
      "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07",
    ];
    const groups = groupSessionsByTerm(dates(mondays), dateOf, TERMS, HOLIDAYS);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Autumn Term 2026");
    expect(groups[0].total).toBe(13);
    expect(groups[0].blocks).toHaveLength(2);
    expect(groups[0].blocks[0].sessions).toHaveLength(7);
    expect(groups[0].blocks[0].breakAfter).toBe("October half term");
    expect(groups[0].blocks[1].sessions).toHaveLength(6);
    expect(groups[0].blocks[1].breakAfter).toBe(null);
  });

  it("starts a new group when sessions cross into the next term", () => {
    const groups = groupSessionsByTerm(
      dates(["2026-12-07", "2026-12-14", "2027-01-11", "2027-01-18"]),
      dateOf,
      TERMS,
      HOLIDAYS,
    );
    expect(groups.map((g) => g.label)).toEqual(["Autumn Term 2026", "Spring Term 2027"]);
    expect(groups[0].total).toBe(2);
    expect(groups[1].total).toBe(2);
  });

  it("labels sessions outside every term", () => {
    const groups = groupSessionsByTerm(dates(["2026-08-24", "2026-08-25"]), dateOf, TERMS, HOLIDAYS);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe(OUTSIDE_TERM_LABEL);
    expect(groups[0].inTerm).toBe(false);
  });

  it("keeps consecutive weeks with no holiday in one block", () => {
    const groups = groupSessionsByTerm(
      dates(["2026-09-07", "2026-09-14", "2026-09-21"]),
      dateOf,
      TERMS,
      HOLIDAYS,
    );
    expect(groups[0].blocks).toHaveLength(1);
  });

  it("handles unsorted input and empty lists", () => {
    expect(groupSessionsByTerm([], dateOf, TERMS, HOLIDAYS)).toEqual([]);
    const groups = groupSessionsByTerm(
      dates(["2026-11-02", "2026-10-19"]),
      dateOf,
      TERMS,
      HOLIDAYS,
    );
    expect(groups[0].blocks).toHaveLength(2);
    expect(groups[0].blocks[0].sessions[0].d).toBe("2026-10-19");
  });
});
