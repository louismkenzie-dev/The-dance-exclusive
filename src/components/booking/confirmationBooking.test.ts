import { describe, expect, it } from "vitest";
import {
  attendeeName,
  calendarEventFor,
  formatDateRange,
  planLabelFor,
  sessionDateFromNotes,
  venueLine,
  whenLine,
  type ConfirmationBooking,
} from "./confirmationBooking";

const venues = { name: "Kelvedon Institute", city: "Kelvedon" };
const base = { id: "b", status: "confirmed", amount: 9, created_at: "2026-09-07T10:05:00Z" };

const standing: ConfirmationBooking = {
  ...base,
  booking_type: "monthly",
  notes: "Stripe pi_test | monthly",
  classes: { name: "Mini Street", start_time: "17:00:00", end_time: "17:45:00", day_of_week: "monday", term_end: "2026-12-18", venues },
  students: { first_name: "Maia", last_name: "Woods" },
};

const dated: ConfirmationBooking = {
  ...base,
  booking_type: "trial",
  notes: "Stripe pi_test | trial | session 2026-09-14",
  classes: { name: "Junior Hiphop", start_time: "17:45:00", end_time: "18:45:00", day_of_week: "monday", term_end: "2026-12-18", venues },
  students: { first_name: "Ava", last_name: "Woods" },
};

const camp: ConfirmationBooking = {
  ...base,
  booking_type: "camp",
  amount: 105,
  notes: "Stripe pi_test | camp",
  camps: { name: "October Half Term Street Camp", start_date: "2026-10-27", end_date: "2026-10-29", venues },
  students: { first_name: "Ava", last_name: "Woods" },
};

describe("confirmation booking lines", () => {
  it("reads the session date out of the server's notes", () => {
    expect(sessionDateFromNotes("Stripe pi_1 | trial | session 2026-09-14")).toBe("2026-09-14");
    expect(sessionDateFromNotes("Stripe pi_1 | monthly")).toBeNull();
    expect(sessionDateFromNotes(null)).toBeNull();
  });

  it("says when: dated, standing and camp bookings", () => {
    expect(whenLine(dated)).toBe("Monday 14 September · 17:45–18:45");
    expect(whenLine(standing)).toBe("Mondays · 17:00–17:45");
    expect(whenLine(camp)).toBe("27–29 Oct");
    expect(whenLine({ ...base, booking_type: "pass", notes: null })).toBeNull();
  });

  it("formats camp date ranges without slicing strings", () => {
    expect(formatDateRange(new Date(2026, 9, 27), new Date(2026, 9, 29))).toBe("27–29 Oct");
    expect(formatDateRange(new Date(2026, 9, 30), new Date(2026, 10, 2))).toBe("30 Oct – 2 Nov");
    expect(formatDateRange(new Date(2026, 9, 27), new Date(2026, 9, 27))).toBe("27 Oct");
    expect(formatDateRange(new Date(2026, 9, 27), null)).toBe("27 Oct");
  });

  it("names the venue, attendee and plan", () => {
    expect(venueLine(standing)).toBe("Kelvedon Institute, Kelvedon");
    expect(venueLine({ ...standing, classes: { ...standing.classes!, venues: { name: "Bolford Hall", city: null } } })).toBe("Bolford Hall");
    expect(venueLine({ ...base, booking_type: "pass", notes: null })).toBeNull();
    expect(attendeeName(standing)).toBe("Maia Woods");
    expect(attendeeName({ ...standing, students: null })).toBeNull();
    expect(planLabelFor(standing)).toBe("Monthly membership");
    expect(planLabelFor(camp)).toBe("Holiday workshop");
    expect(planLabelFor({ ...standing, booking_type: "mystery" })).toBe("mystery");
  });
});

describe("calendarEventFor", () => {
  const now = new Date(2026, 8, 9, 12, 0); // Wed 9 Sep 2026

  it("puts a dated session on its date, no repeat", () => {
    const ev = calendarEventFor(dated, now)!;
    expect(ev.title).toBe("Junior Hiphop · Ava");
    expect(ev.start).toEqual(new Date(2026, 8, 14, 17, 45));
    expect(ev.end).toEqual(new Date(2026, 8, 14, 18, 45));
    expect(ev.location).toBe("Kelvedon Institute, Kelvedon");
    expect(ev.repeatWeeklyUntil).toBeUndefined();
  });

  it("starts a standing booking on the next weekday and repeats to the term end", () => {
    const ev = calendarEventFor(standing, now)!;
    expect(ev.title).toBe("Mini Street · Maia");
    expect(ev.start).toEqual(new Date(2026, 8, 14, 17, 0));
    expect(ev.end).toEqual(new Date(2026, 8, 14, 17, 45));
    expect(ev.repeatWeeklyUntil).toBe("2026-12-18");
    expect(calendarEventFor({ ...standing, classes: { ...standing.classes!, term_end: undefined } }, now)?.repeatWeeklyUntil).toBeNull();
  });

  it("spans a camp with the standard day times and says so", () => {
    const ev = calendarEventFor(camp, now)!;
    expect(ev.start).toEqual(new Date(2026, 9, 27, 9, 0));
    expect(ev.end).toEqual(new Date(2026, 9, 29, 15, 0));
    expect(ev.description).toContain("09:00–15:00");
  });

  it("gives up gracefully when there is nothing to schedule", () => {
    expect(calendarEventFor({ ...base, booking_type: "pass", notes: null }, now)).toBeNull();
    expect(calendarEventFor({ ...standing, classes: { ...standing.classes!, day_of_week: "" } }, now)).toBeNull();
    expect(calendarEventFor({ ...camp, camps: { ...camp.camps!, start_date: null } }, now)).toBeNull();
  });
});
