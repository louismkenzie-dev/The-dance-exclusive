import { describe, expect, it } from "vitest";
import config from "../../vercel.json";
import { bookingCoverImage } from "./bookingCoverImage";

const original = "https://suwaetnsszlpaaykhpif.supabase.co/storage/v1/object/public/workshop-media/covers/class.jpeg";
describe("responsive booking cover delivery", () => {
  it("uses configured widths and quality while preserving the original URL", () => {
    const result = bookingCoverImage(original, "33vw", true)!;
    expect(result.sizes).toBe("33vw");
    for (const candidate of result.srcSet.split(", ")) {
      const [src, width] = candidate.split(" ");
      const url = new URL(src, "https://example.com");
      expect(url.searchParams.get("url")).toBe(original);
      expect(config.images.sizes).toContain(Number(width.slice(0, -1)));
      expect(config.images.qualities).toContain(Number(url.searchParams.get("q")));
    }
  });
  it("leaves local development, private media and external URLs untouched", () => {
    expect(bookingCoverImage(original, "33vw", false)).toBeNull();
    for (const src of [original.replace("/public/", "/sign/"), original.replace(".supabase.co", ".supabase.co.evil.test"), "/media/local.webp", original.replace(".jpeg", ".svg")]) {
      expect(bookingCoverImage(src, "33vw", true)).toBeNull();
    }
  });
  it("optimises public admin venue photos with an allowed deployment pattern", () => {
    const venue = original.replace("workshop-media/covers/class.jpeg", "venue-photos/hall/gallery/inside.jpg");
    expect(bookingCoverImage(venue, "40vw", true)?.src).toContain(encodeURIComponent(venue));
    expect(config.images.remotePatterns.some(pattern => pattern.pathname === "/storage/v1/object/public/venue-photos/**")).toBe(true);
    expect(bookingCoverImage(venue.replace("/public/", "/authenticated/"), "40vw", true)).toBeNull();
  });
});
