import { describe, it, expect } from "vitest";
import { isAttendeeProfileComplete, attendeeProfileGap } from "./attendeeProfile";

const profile = (overrides = {}) => ({
  id: "s1",
  date_of_birth: "1990-01-01",
  ...overrides,
});

describe("attendee profile booking gate", () => {
  it("accepts a profile with a date of birth", () => {
    expect(isAttendeeProfileComplete(profile())).toBe(true);
    expect(attendeeProfileGap(profile())).toBeNull();
  });

  it("rejects a missing profile (adult with no self profile)", () => {
    expect(isAttendeeProfileComplete(null)).toBe(false);
    expect(attendeeProfileGap(null)).toMatch(/No attendee profile/);
  });

  it("rejects a profile without a date of birth", () => {
    expect(isAttendeeProfileComplete(profile({ date_of_birth: null }))).toBe(false);
    expect(attendeeProfileGap(profile({ date_of_birth: null }))).toMatch(/Date of birth/);
  });
});
