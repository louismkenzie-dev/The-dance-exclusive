import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicVenue } from "./publicSchool";
import { lookupVenuePostcodes, normalisePostcode, savedVenuePoint, venueSlides } from "./venueTour";
const venue = { name: "Test hall", hero_image: "https://example.com/art.png", photo_outside: null } as PublicVenue;
afterEach(() => vi.unstubAllGlobals());
describe("public venue tour data", () => {
  it("prioritises real admin gallery photos and their order over hero artwork", () => {
    const photos = [{ id: "later", file_path: "hall/later photo.jpg", caption: "Inside", category: "indoor", is_primary: false, sort_order: 1 }, { id: "primary", file_path: "hall/primary.jpg", caption: null, category: "outside", is_primary: true, sort_order: 2 }];
    const slides = venueSlides({ ...venue, venue_photos: photos }, "https://example.com");
    expect(slides).toHaveLength(2);
    expect(slides[0].src).toContain("hall/primary.jpg");
    expect(slides[1]).toEqual({ src: "https://example.com/storage/v1/object/public/venue-photos/hall/later%20photo.jpg", caption: "Inside" });
    expect(photos[0].id).toBe("later");
  });
  it("falls back to the saved venue art only when no photos exist", () => {
    expect(venueSlides(venue, "https://example.com")[0].caption).toContain("Venue preview");
    expect(venueSlides({ ...venue, hero_image: null }, "https://example.com")).toEqual([]);
  });
  it("accepts a zero longitude and rejects absent or invalid coordinates", () => {
    expect(savedVenuePoint({ latitude: 51.5, longitude: 0 })).toEqual({ latitude: 51.5, longitude: 0, approximate: false });
    expect(savedVenuePoint({ latitude: null, longitude: 0 })).toBeNull();
    expect(savedVenuePoint({ latitude: 100, longitude: 0 })).toBeNull();
    expect(normalisePostcode("co7 7yz")).toBe("CO77YZ");
  });
  it("labels postcode coordinates approximate and tolerates lookup failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ result: { latitude: 51.8, longitude: .9 } }) }).mockRejectedValueOnce(new Error("offline")));
    expect(await lookupVenuePostcodes(["CO77YZ", "INVALID"])).toEqual({ CO77YZ: { latitude: 51.8, longitude: .9, approximate: true } });
  });
});
