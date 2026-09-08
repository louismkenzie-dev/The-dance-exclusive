import { describe, expect, it } from "vitest";
import { canAccessRoute, homeRouteFor } from "./routeAccess";

describe("canAccessRoute", () => {
  it("lets an admin open every area", () => {
    // The studio owner is admin AND staff. Before this, being made admin
    // redirected her out of /staff and away from the door register.
    expect(canAccessRoute("admin", "admin")).toBe(true);
    expect(canAccessRoute("admin", "staff")).toBe(true);
    expect(canAccessRoute("admin", "parent")).toBe(true);
  });

  it("keeps staff inside the staff area", () => {
    expect(canAccessRoute("staff", "staff")).toBe(true);
    expect(canAccessRoute("staff", "admin")).toBe(false);
    expect(canAccessRoute("staff", "parent")).toBe(false);
  });

  it("keeps parents inside the portal", () => {
    expect(canAccessRoute("parent", "parent")).toBe(true);
    expect(canAccessRoute("parent", "admin")).toBe(false);
    expect(canAccessRoute("parent", "staff")).toBe(false);
  });

  it("allows an unguarded route for anyone signed in", () => {
    expect(canAccessRoute("parent", undefined)).toBe(true);
    expect(canAccessRoute(null, undefined)).toBe(true);
  });

  it("refuses a guarded route while the role is still unknown", () => {
    // Guards render only after AuthContext resolves, but never fail open.
    expect(canAccessRoute(null, "admin")).toBe(false);
    expect(canAccessRoute(undefined, "staff")).toBe(false);
  });
});

describe("homeRouteFor", () => {
  it("sends each role to its own landing page", () => {
    expect(homeRouteFor("admin")).toBe("/admin");
    expect(homeRouteFor("staff")).toBe("/staff");
    expect(homeRouteFor("parent")).toBe("/");
    expect(homeRouteFor(null)).toBe("/");
  });
});
