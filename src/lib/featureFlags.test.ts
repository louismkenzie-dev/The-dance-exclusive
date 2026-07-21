import { describe, it, expect } from "vitest";
import { ENABLE_POSTCODE_VENUE_FINDER } from "./featureFlags";

describe("feature flags", () => {
  it("postcode venue finder stays disabled by default (commercially unapproved)", () => {
    // VITE_ENABLE_POSTCODE_VENUE_FINDER is not set in the test environment,
    // so the flag must resolve to false.
    expect(ENABLE_POSTCODE_VENUE_FINDER).toBe(false);
  });
});
