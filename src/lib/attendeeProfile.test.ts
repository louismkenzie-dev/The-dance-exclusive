import { describe, it, expect } from "vitest";
import { isAttendeeProfileComplete, attendeeProfileGap } from "./attendeeProfile";

const profile = (overrides = {}) => ({
  id: "s1",
  date_of_birth: "1990-01-01",
  expected_arrival_time: "17:00:00",
  expected_departure_time: "18:00:00",
  ...overrides,
});

describe("attendee profile booking gate", () => {
  it("accepts a complete profile", () => {
    expect(isAttendeeProfileComplete(profile())).toBe(true);
    expect(attendeeProfileGap(profile())).toBeNull();
  });

  it("rejects a missing profile (adult with no self profile)", () => {
    expect(isAttendeeProfileComplete(null)).toBe(false);
    expect(attendeeProfileGap(null)).toMatch(/No attendee profile/);
  });

  it("rejects profiles without arrival/departure times", () => {
    expect(isAttendeeProfileComplete(profile({ expected_arrival_time: null }))).toBe(false);
    expect(isAttendeeProfileComplete(profile({ expected_departure_time: null }))).toBe(false);
    expect(attendeeProfileGap(profile({ expected_arrival_time: null }))).toMatch(/arrival\/departure/);
  });

  it("rejects profiles without a date of birth", () => {
    expect(isAttendeeProfileComplete(profile({ date_of_birth: null }))).toBe(false);
    expect(attendeeProfileGap(profile({ date_of_birth: null }))).toMatch(/Date of birth/);
  });
});
