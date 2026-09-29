import { describe, expect, it } from "vitest";
import { isPassBooking, passIdFromNotes, passSummary } from "./registerPass";
import { passRef } from "../../supabase/functions/_shared/classRefunds.ts";

const ID = "7d1c9a52-3b1e-4f0a-9c2d-5e6f7a8b9c0d";
const FROM_PARENT = `Class pass ${ID} — session 2026-09-14`; // redeem-pass
const FROM_STUDIO = `Class pass ${ID} — session 2026-09-14 | recorded by the studio (paid at the door)`; // admin-book

describe("isPassBooking", () => {
  it("is true for a place marked as a pass booking", () => {
    expect(isPassBooking({ booking_type: "pass", notes: FROM_PARENT })).toBe(true);
    expect(isPassBooking({ booking_type: "pass", notes: null })).toBe(true);
  });

  it("falls back to the note for a row written before the type was set", () => {
    expect(isPassBooking({ booking_type: "single", notes: FROM_STUDIO })).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isPassBooking({ booking_type: "trial", notes: "Trial — session 2026-09-14" })).toBe(false);
    expect(isPassBooking({ booking_type: "monthly", notes: null })).toBe(false);
    expect(isPassBooking(null)).toBe(false);
    // Mentioning a pass in passing is not a pass booking.
    expect(isPassBooking({ booking_type: "single", notes: "Asked about a class pass" })).toBe(false);
  });
});

describe("passIdFromNotes", () => {
  it("reads the pass from both places that write one", () => {
    expect(passIdFromNotes(FROM_PARENT)).toBe(ID);
    expect(passIdFromNotes(FROM_STUDIO)).toBe(ID);
    expect(passIdFromNotes(null)).toBeNull();
  });

  it("agrees with the server's own rule", () => {
    for (const n of [FROM_PARENT, FROM_STUDIO, "Class pass — session 2026-09-14", "", "nothing"]) {
      expect(passIdFromNotes(n)).toBe(passRef(n));
    }
  });
});

describe("passSummary", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("says how many classes are left and when it runs out", () => {
    expect(passSummary({ sessions_total: 5, sessions_remaining: 3, expires_at: "2026-11-14T00:00:00Z" }, now))
      .toEqual({ text: "3 of 5 classes left · expires 14 Nov", low: false });
  });

  it("flags the last class on a pass", () => {
    expect(passSummary({ sessions_total: 5, sessions_remaining: 1, expires_at: null }, now))
      .toEqual({ text: "1 of 5 classes left", low: true });
  });

  it("flags a pass that has run out or expired", () => {
    expect(passSummary({ sessions_total: 4, sessions_remaining: 0, expires_at: null }, now).text).toBe("No classes left");
    expect(passSummary({ sessions_total: 4, sessions_remaining: 2, expires_at: "2026-09-01T00:00:00Z" }, now))
      .toEqual({ text: "2 of 4 classes left · expired 1 Sep", low: true });
  });

  it("copes with a one-class pass and missing numbers", () => {
    expect(passSummary({ sessions_total: 1, sessions_remaining: 1, expires_at: null }, now).text).toBe("1 of 1 class left");
    expect(passSummary({ sessions_total: null, sessions_remaining: null, expires_at: "not a date" }, now).text).toBe("No classes left");
  });
});
