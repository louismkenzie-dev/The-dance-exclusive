import { describe, it, expect } from "vitest";
import {
  attendeeKey,
  convertedAfterTrial,
  type Purchase,
} from "../../supabase/functions/_shared/trialConversion";
import * as mirror from "./trialConversion";

const TRIAL_AT = "2026-09-11T06:54:00Z";
const DAD = "parent-williamson";
const ASHER = "student-asher";

describe("did the dancer who trialled go on to book?", () => {
  it("does not count a class the parent bought for themselves", () => {
    // Michael booked himself onto adult hip hop after Asher's trial.
    const purchases: Purchase[] = [
      { studentId: "student-michael", parentId: DAD, at: "2026-09-14T13:12:00Z" },
    ];
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(false);
  });

  it("counts a class bought for the dancer who trialled", () => {
    const purchases: Purchase[] = [
      { studentId: ASHER, parentId: DAD, at: "2026-09-14T13:12:00Z" },
    ];
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(true);
  });

  it("does not count a sibling's booking", () => {
    const purchases: Purchase[] = [
      { studentId: "student-sibling", parentId: DAD, at: "2026-09-14T13:12:00Z" },
    ];
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(false);
  });

  it("ignores anything bought before the trial", () => {
    const purchases: Purchase[] = [
      { studentId: ASHER, parentId: DAD, at: "2026-08-01T09:00:00Z" },
    ];
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(false);
  });

  it("treats an adult with no student row as themselves", () => {
    const purchases: Purchase[] = [
      { studentId: null, parentId: DAD, at: "2026-09-14T13:12:00Z" },
    ];
    expect(convertedAfterTrial(purchases, null, DAD, TRIAL_AT)).toBe(true);
    // ...and that adult booking still isn't their child's conversion.
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(false);
  });

  it("ignores a purchase with no timestamp", () => {
    const purchases: Purchase[] = [{ studentId: ASHER, parentId: DAD, at: null }];
    expect(convertedAfterTrial(purchases, ASHER, DAD, TRIAL_AT)).toBe(false);
  });

  it("names the attendee the same way on both sides", () => {
    expect(attendeeKey(ASHER, DAD)).toBe(mirror.attendeeKey(ASHER, DAD));
    expect(attendeeKey(null, DAD)).toBe(mirror.attendeeKey(null, DAD));
    expect(attendeeKey(ASHER, DAD)).not.toBe(attendeeKey(null, DAD));
  });
});
