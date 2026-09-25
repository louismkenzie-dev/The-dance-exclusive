import { describe, expect, it } from "vitest";
import {
  hasCurrentSchedule,
  schoolDate,
  type PublicSchool,
} from "./publicSchool";
import {
  isBookingAppPath,
  publicPaths,
  publicRouteStatus,
  safeJson,
  sitemapXml,
} from "./publicRouting";

describe("public publication boundaries", () => {
  it("expires schedules at the school's local date, including British Summer Time", () => {
    expect(schoolDate(new Date("2026-09-25T23:30:00Z"))).toBe("2026-09-26");
    expect(schoolDate(new Date("2026-12-25T23:30:00Z"))).toBe("2026-12-25");
    expect(hasCurrentSchedule("2026-10-01", ["2026-09-25"], "2026-09-26")).toBe(
      false,
    );
    expect(hasCurrentSchedule(null, ["2026-09-26"], "2026-09-26")).toBe(true);
  });

  it("keeps a published future term without dates but removes an ended term", () => {
    expect(hasCurrentSchedule("2026-10-01", [], "2026-09-26")).toBe(true);
    expect(hasCurrentSchedule("2026-09-25", [], "2026-09-26")).toBe(false);
    expect(hasCurrentSchedule(null, [], "2026-09-26")).toBe(true);
  });

  const school = {
    classes: [{ id: "class-1", class_type: "children" }],
    venues: [{ id: "venue-1", slug: "chelmsford" }],
    coaches: [{ id: "coach-1" }],
    camps: [{ id: "camp-1" }],
  } as PublicSchool;

  it("publishes the same record URLs in routing and the sitemap", () => {
    for (const path of publicPaths(school))
      expect(publicRouteStatus(path, school)).toBe(200);
    const xml = sitemapXml(school, "https://www.thedanceexclusive.co.uk");
    expect(xml).toContain("/classes/children/class-1</loc>");
    expect(xml).toContain("/venues/chelmsford</loc>");
    expect(xml).not.toMatch(/\/auth|\/admin|\/checkout|\/book\//);
  });

  it("removes withdrawn records from both discovery and HTTP success status", () => {
    const withdrawn = { ...school, classes: [], coaches: [], camps: [] };
    expect(publicRouteStatus("/classes/children/class-1", withdrawn)).toBe(404);
    expect(publicRouteStatus("/team/coach-1", withdrawn)).toBe(404);
    expect(publicRouteStatus("/events/camp-1", withdrawn)).toBe(404);
    expect(sitemapXml(withdrawn, "https://example.com")).not.toContain(
      "camp-1",
    );
    expect(publicRouteStatus("/classes/adult/class-1", school)).toBe(404);
  });

  it("keeps booking/authentication routes out of the shared rendered cache", () => {
    for (const path of [
      "/auth",
      "/admin",
      "/staff/profile",
      "/account/bookings",
      "/checkout/return",
      "/book/class-1",
      "/classes/children",
    ])
      expect(isBookingAppPath(path)).toBe(true);
    expect(isBookingAppPath("/classes/children/class-1")).toBe(false);
    expect(isBookingAppPath("/team/coach-1")).toBe(false);
  });

  it("serializes editorial content without allowing a script to close its element", () => {
    const value = {
      description: '</script><script>alert("x")</script>\u2028&',
    };
    expect(safeJson(value)).not.toContain("<");
    expect(JSON.parse(safeJson(value))).toEqual(value);
    expect(
      sitemapXml(
        { ...school, venues: [{ id: "v", slug: "A&B" }] } as PublicSchool,
        "https://example.com",
      ),
    ).toContain("A%26B");
  });
});
