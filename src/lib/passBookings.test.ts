import { describe, it, expect } from "vitest";
import { describePass, isPassBooking, passIdFromBooking } from "./passBookings";

describe("class-pass bookings on the register", () => {
  const passBooking = {
    booking_type: "pass",
    notes: "Class pass 3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607 — session 2026-09-10",
  };

  it("recognises a pass booking and finds its pass", () => {
    expect(isPassBooking(passBooking)).toBe(true);
    expect(passIdFromBooking(passBooking)).toBe("3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607");
  });

  it("leaves ordinary bookings alone", () => {
    const dropIn = { booking_type: "session", notes: "Stripe PaymentIntent: pi_123 | session 2026-09-10" };
    expect(isPassBooking(dropIn)).toBe(false);
    expect(passIdFromBooking(dropIn)).toBeNull();
  });

  it("copes with a pass booking whose notes were edited", () => {
    expect(passIdFromBooking({ booking_type: "pass", notes: "redeemed at the door" })).toBeNull();
    expect(isPassBooking({ booking_type: "pass", notes: null })).toBe(true);
  });

  it("describes a pass for the door team", () => {
    expect(describePass({ label: "4-class pass", sessionsRemaining: 2, sessionsTotal: 4 }))
      .toBe("4-class pass · 2 of 4 left");
    expect(describePass({ label: null, sessionsRemaining: null, sessionsTotal: null })).toBe("Class pass");
    expect(describePass(null)).toBe("Class pass");
  });
});
