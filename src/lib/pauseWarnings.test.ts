import { describe, it, expect } from "vitest";
import {
  cleanReason, looksLikeCancellation, daysBetween, groupPauseWarnings,
  totalMonthlyPounds, dueWarnings, describeWarning, type PausedMembershipRow,
} from "./pauseWarnings";

const TODAY = "2026-09-28";

// The two families actually paused on live, so the tests are about real rows.
const BROOKE_REASON = '"Brooke has had a seizure and can\'t walk — agreed to pause October"';
const brooke = (amount: number, i: number): PausedMembershipRow => ({
  membershipId: `b${i}`,
  userId: "user-brooke",
  dancerName: "Brooke George",
  pausedUntil: "2026-11-05",
  pauseReason: BROOKE_REASON,
  monthlyAmount: amount,
});
const poppy: PausedMembershipRow = {
  membershipId: "p1",
  userId: "user-beatwell",
  dancerName: "Poppy Beatwell",
  pausedUntil: "2027-01-05",
  pauseReason: "Leaving",
  monthlyAmount: 30.6,
};

describe("pauseWarnings", () => {
  describe("cleanReason", () => {
    it("strips the literal quote marks some reasons were stored with", () => {
      expect(cleanReason(BROOKE_REASON)).toBe(
        "Brooke has had a seizure and can't walk — agreed to pause October",
      );
    });
    it("returns null for nothing useful", () => {
      expect(cleanReason(null)).toBeNull();
      expect(cleanReason("   ")).toBeNull();
      expect(cleanReason('""')).toBeNull();
    });
  });

  describe("looksLikeCancellation", () => {
    it("catches the ways someone says a family has gone", () => {
      for (const r of [
        "Leaving", "leaving the area", "She's left", "quitting dance",
        "not returning after Christmas", "no longer attending", "stopping classes",
        "finished with us", "Withdrawn",
      ]) {
        expect(looksLikeCancellation(r), r).toBe(true);
      }
    });

    it("does NOT flag a genuine pause — this one matters", () => {
      // Telling Amie that Brooke, who has had a seizure, looks like a leaver would be both wrong
      // and unkind. Every reason here is someone coming back.
      for (const r of [
        BROOKE_REASON,
        "Broken ankle, back in January",
        "Holiday for a month",
        "Maternity",
        "Exams — returning in summer",
        "Financial hardship, agreed 2 months",
      ]) {
        expect(looksLikeCancellation(r), r).toBe(false);
      }
    });

    it("is not fooled by a word merely containing the letters", () => {
      expect(looksLikeCancellation("Cleaving to the schedule")).toBe(false);
      expect(looksLikeCancellation("Bereavement")).toBe(false);
    });

    it("handles nothing at all", () => {
      expect(looksLikeCancellation(null)).toBe(false);
      expect(looksLikeCancellation("")).toBe(false);
    });
  });

  it("counts days between dates", () => {
    expect(daysBetween(TODAY, "2026-11-05")).toBe(38);
    expect(daysBetween(TODAY, "2027-01-05")).toBe(99);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween(TODAY, "2026-09-27")).toBe(-1);
    expect(daysBetween(TODAY, "2026-11-05T07:00:00+00")).toBe(38); // timestamps too
  });

  describe("grouping — the duplicate-warning problem", () => {
    // Brooke really does hold seven memberships with one reason and one date.
    const brookeRows = [26.35, 0, 26.35, 30.6, 0.35, 0, 26.35].map(brooke);

    it("turns seven memberships into ONE warning", () => {
      const w = groupPauseWarnings(brookeRows, TODAY);
      expect(w).toHaveLength(1);
      expect(w[0].membershipCount).toBe(7);
      expect(w[0].dancerNames).toEqual(["Brooke George"]);
    });

    it("totals what will actually restart", () => {
      const w = groupPauseWarnings(brookeRows, TODAY);
      expect(totalMonthlyPounds(w[0])).toBe(110); // the unlimited cap, split across items
    });

    it("keeps separate families separate", () => {
      const w = groupPauseWarnings([...brookeRows, poppy], TODAY);
      expect(w).toHaveLength(2);
      expect(w.map((x) => x.pausedUntil)).toEqual(["2026-11-05", "2027-01-05"]); // soonest first
    });

    it("splits one family across two different resume dates", () => {
      const w = groupPauseWarnings(
        [brooke(10, 1), { ...brooke(10, 2), pausedUntil: "2026-12-05" }],
        TODAY,
      );
      expect(w).toHaveLength(2);
    });

    it("lists several dancers in one household once each", () => {
      const w = groupPauseWarnings(
        [brooke(10, 1), { ...brooke(10, 2), dancerName: "Alfie George" }, brooke(10, 3)],
        TODAY,
      );
      expect(w[0].dancerNames).toEqual(["Alfie George", "Brooke George"]);
    });

    it("ignores a paused row with no resume date", () => {
      expect(groupPauseWarnings([{ ...poppy, pausedUntil: null }], TODAY)).toEqual([]);
    });

    it("marks the family if any one membership reads as leaving", () => {
      const w = groupPauseWarnings(
        [brooke(10, 1), { ...brooke(10, 2), pauseReason: "Leaving" }],
        TODAY,
      );
      expect(w[0].looksLikeCancellation).toBe(true);
    });
  });

  describe("what lands on the dashboard", () => {
    const warnings = groupPauseWarnings([brooke(26.35, 1), poppy], TODAY);

    it("shows a pause resuming soon", () => {
      // Brooke is 38 days out, so not within 21 — but she is within 60.
      expect(dueWarnings(warnings, 60).some((w) => w.dancerNames[0] === "Brooke George")).toBe(true);
      expect(dueWarnings(warnings, 21).some((w) => w.dancerNames[0] === "Brooke George")).toBe(false);
    });

    it("shows a leaving-pause however far away it is — the whole point", () => {
      // Poppy is 99 days out. She must surface now, not the day before she is billed.
      const due = dueWarnings(warnings, 21);
      expect(due.some((w) => w.dancerNames[0] === "Poppy Beatwell")).toBe(true);
    });

    it("words the two cases differently", () => {
      const p = warnings.find((w) => w.dancerNames[0] === "Poppy Beatwell")!;
      const b = warnings.find((w) => w.dancerNames[0] === "Brooke George")!;
      expect(describeWarning(p, "5 Jan 2027")).toMatch(/paused, not cancelled/);
      expect(describeWarning(p, "5 Jan 2027")).toContain("£30.60/month restarts 5 Jan 2027");
      expect(describeWarning(b, "5 Nov 2026")).toMatch(/restart/);
      expect(describeWarning(b, "5 Nov 2026")).not.toMatch(/not cancelled/);
    });

    it("does not show pounds to fifteen decimal places", () => {
      const w = groupPauseWarnings([brooke(26.35, 1), brooke(26.35, 2), brooke(30.6, 3)], TODAY);
      expect(describeWarning(w[0], "5 Nov 2026")).toContain("£83.30");
    });
  });
});
