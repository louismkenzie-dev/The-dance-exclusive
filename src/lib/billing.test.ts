import { describe, expect, it } from "vitest";
import {
  chargesFirstMonthAtSignup,
  firstBillingAnchor,
  freeMonthFor,
  isAugustLondon,
  londonYMD,
  noticeEndsByToday,
  resumeAfterFreeMonth,
} from "./billing";

// Fixed instants (UTC) — London is BST (+1) in summer, GMT in winter.
const AUG_3 = new Date("2026-08-03T12:00:00Z");
const FEB_20 = new Date("2026-02-20T12:00:00Z");
const DEC_31_LATE = new Date("2026-12-31T23:30:00Z"); // still 31 Dec in London (GMT)
const JAN_10 = new Date("2027-01-10T12:00:00Z");
const AUG_31_LATE_BST = new Date("2026-08-31T23:30:00Z"); // 00:30 on 1 SEPT in London!
const SEPT_10 = new Date("2026-09-10T12:00:00Z");

describe("londonYMD / isAugustLondon", () => {
  it("uses London civil time, not UTC", () => {
    // 23:30 UTC on 31 Aug is already 1 September in London (BST) — this
    // instant must NOT be treated as August.
    expect(londonYMD(AUG_31_LATE_BST)).toEqual({ y: 2026, m: 9, day: 1 });
    expect(isAugustLondon(AUG_31_LATE_BST)).toBe(false);
    expect(isAugustLondon(AUG_3)).toBe(true);
    expect(isAugustLondon(FEB_20)).toBe(false);
  });
});

describe("firstBillingAnchor — 5th of the month after signup", () => {
  it("August signup anchors to 5 September", () => {
    expect(firstBillingAnchor(AUG_3).toISOString()).toBe("2026-09-05T07:00:00.000Z");
  });

  it("February signup anchors to 5 March", () => {
    expect(firstBillingAnchor(FEB_20).toISOString()).toBe("2026-03-05T07:00:00.000Z");
  });

  it("December signup wraps the year to 5 January", () => {
    expect(firstBillingAnchor(DEC_31_LATE).toISOString()).toBe("2027-01-05T07:00:00.000Z");
  });

  it("an instant that is already September in London anchors to 5 October", () => {
    expect(firstBillingAnchor(AUG_31_LATE_BST).toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });
});

describe("freeMonthFor — 11 paid months, the 12th free", () => {
  it("August signups (September starters) get August free", () => {
    expect(freeMonthFor(AUG_3)).toBe(8);
  });

  it("September signups also get August free", () => {
    expect(freeMonthFor(SEPT_10)).toBe(8);
  });

  it("a February joiner skips January (Amie's worked example)", () => {
    expect(freeMonthFor(FEB_20)).toBe(1);
  });

  it("a January joiner skips December", () => {
    expect(freeMonthFor(JAN_10)).toBe(12);
  });
});

describe("chargesFirstMonthAtSignup", () => {
  it("charges immediately in every month except August", () => {
    expect(chargesFirstMonthAtSignup(FEB_20)).toBe(true);
    expect(chargesFirstMonthAtSignup(SEPT_10)).toBe(true);
    expect(chargesFirstMonthAtSignup(AUG_3)).toBe(false);
  });
});

describe("resumeAfterFreeMonth", () => {
  it("resumes on 1 September after an August free month", () => {
    expect(resumeAfterFreeMonth(8, AUG_3).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("a December free month resumes on 1 January of the next year", () => {
    expect(resumeAfterFreeMonth(12, new Date("2026-12-10T12:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("a January free month observed in January resumes on 1 February", () => {
    expect(resumeAfterFreeMonth(1, JAN_10).toISOString()).toBe("2027-02-01T00:00:00.000Z");
  });
});

describe("noticeEndsByToday — remove the class before the 5th's payment is raised", () => {
  const NOTICE_END = "2026-11-05T07:00:00.000Z"; // as cancel stores it: the next billing instant

  it("THE BUG: at 06:10 on the 5th the notice has run out, though it is 50 minutes before 07:00", () => {
    expect(noticeEndsByToday(NOTICE_END, new Date("2026-11-05T06:10:00Z"))).toBe(true);
  });

  it("is not due the day before, nor a month earlier", () => {
    expect(noticeEndsByToday(NOTICE_END, new Date("2026-11-04T06:10:00Z"))).toBe(false);
    expect(noticeEndsByToday(NOTICE_END, new Date("2026-10-05T06:10:00Z"))).toBe(false);
  });

  it("stays due afterwards, so a missed run catches up", () => {
    expect(noticeEndsByToday(NOTICE_END, new Date("2026-11-06T06:10:00Z"))).toBe(true);
  });

  it("uses London's calendar day, including across the BST boundary", () => {
    // 23:30 UTC on 4 Oct is 00:30 on 5 Oct in London (BST).
    expect(noticeEndsByToday("2026-10-05T07:00:00Z", new Date("2026-10-04T23:30:00Z"))).toBe(true);
  });

  it("is never due without a date", () => {
    expect(noticeEndsByToday(null)).toBe(false);
    expect(noticeEndsByToday("not a date")).toBe(false);
  });

  it("agrees with the server copy", async () => {
    const server = await import("../../supabase/functions/_shared/billing.ts");
    for (const now of ["2026-11-05T06:10:00Z", "2026-11-04T06:10:00Z", "2026-10-04T23:30:00Z"]) {
      expect(server.noticeEndsByToday(NOTICE_END, new Date(now))).toBe(noticeEndsByToday(NOTICE_END, new Date(now)));
    }
  });
});
