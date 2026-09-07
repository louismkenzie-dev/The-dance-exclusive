import { describe, expect, it } from "vitest";
import { atDate, buildIcs, googleCalendarUrl, nextOccurrence } from "./calendarLinks";

describe("calendar links", () => {
  const ev = {
    title: "Mini Street",
    start: atDate("2026-09-14", "17:00:00"),
    end: atDate("2026-09-14", "17:45:00"),
    location: "Kelvedon Institute, Kelvedon",
    description: "Maia's class",
    repeatWeeklyUntil: "2026-12-18",
  };

  it("builds a Google Calendar template URL with a weekly repeat", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("text")).toBe("Mini Street");
    expect(url.searchParams.get("dates")).toMatch(/^20260914T\d{6}Z\/20260914T\d{6}Z$/);
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;UNTIL=20261218T235959");
  });

  it("builds a valid .ics with escaped text and local times", () => {
    const ics = buildIcs({ ...ev, description: "Bring water, shoes; ready" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260914T170000");
    expect(ics).toContain("DTEND:20260914T174500");
    expect(ics).toContain("DESCRIPTION:Bring water\\, shoes\\; ready");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261218T235959");
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
  });

  it("finds the next weekday occurrence, rolling a week if today's slot has passed", () => {
    const monday10 = new Date(2026, 8, 7, 10, 0); // Mon 7 Sep 2026 10:00
    expect(nextOccurrence("monday", "17:00", monday10)?.getDate()).toBe(7);
    const monday18 = new Date(2026, 8, 7, 18, 0);
    expect(nextOccurrence("monday", "17:00", monday18)?.getDate()).toBe(14);
    expect(nextOccurrence("thursday", "15:15", monday10)?.getDate()).toBe(10);
    expect(nextOccurrence("funday", "15:15", monday10)).toBeNull();
  });
});
